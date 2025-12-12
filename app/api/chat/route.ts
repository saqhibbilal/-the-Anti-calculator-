import { NextRequest } from 'next/server'
import {
  callMistralAPI,
  parseMistralStream,
  getAvailableTools,
  getSystemPrompt,
  type MistralMessage,
} from '@/lib/mistral'
import {
  calculateMortgage,
  analyzeBuyVsRent,
  calculateEMI,
  type MortgageInputs,
  type BuyVsRentInputs,
} from '@/lib/math'
import { extractParameters } from '@/lib/extractors'

// In-memory conversation state (in production, use database)
const conversationStates = new Map<string, {
  messages: MistralMessage[]
  scenario: 'buy-vs-rent' | 'refinance-check'
  extractedData: Record<string, any>
}>()

const CONTEXT_WINDOW = 10

/**
 * Execute tool/function call
 */
function executeToolCall(
  toolName: string,
  args: any,
  scenario: 'buy-vs-rent' | 'refinance-check'
): any {
  try {
    switch (toolName) {
      case 'calculate_mortgage': {
        if (!args.propertyPrice || args.propertyPrice <= 0) {
          return { error: 'propertyPrice is required and must be > 0' }
        }
        const inputs: MortgageInputs = {
          propertyPrice: args.propertyPrice,
          downPayment: args.downPayment,
          tenure: args.tenure,
        }
        return calculateMortgage(inputs)
      }

      case 'analyze_buy_vs_rent': {
        if (!args.propertyPrice || !args.monthlyRent || !args.stayDuration) {
          return { error: 'propertyPrice, monthlyRent, and stayDuration are required' }
        }
        const inputs: BuyVsRentInputs = {
          propertyPrice: args.propertyPrice,
          monthlyRent: args.monthlyRent,
          downPayment: args.downPayment,
          stayDuration: args.stayDuration,
          tenure: args.tenure,
        }
        return analyzeBuyVsRent(inputs)
      }

      case 'calculate_refinance': {
        const { currentLoanAmount, currentInterestRate, currentTenure, newInterestRate, switchingCosts } = args
        
        // Calculate EMIs directly using loan amounts
        const currentEMI = calculateEMI(currentLoanAmount, currentInterestRate, currentTenure)
        const newEMI = calculateEMI(currentLoanAmount, newInterestRate, currentTenure)

        const monthlySavings = currentEMI - newEMI
        const breakEvenMonths = monthlySavings > 0 ? switchingCosts / monthlySavings : Infinity
        const totalSavingsOverRemainingTenure = monthlySavings * (currentTenure * 12) - switchingCosts

        return {
          currentEMI,
          newEMI,
          monthlySavings,
          breakEvenMonths: breakEvenMonths === Infinity ? null : breakEvenMonths,
          totalSavingsOverRemainingTenure,
          recommendation: monthlySavings > 0 && breakEvenMonths < currentTenure * 12 ? 'refinance' : 'keep_current',
        }
      }

      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error)
    return { error: 'Tool execution failed' }
  }
}

function buildContextMessages(state: { messages: MistralMessage[] }): MistralMessage[] {
  if (state.messages.length <= CONTEXT_WINDOW + 1) return state.messages
  const system = state.messages[0]
  let recent = state.messages.slice(-CONTEXT_WINDOW)

  // Ensure the first message after system is not a tool; if it is, pull one more from history until fixed
  let idx = state.messages.length - CONTEXT_WINDOW - 1
  while (recent[0]?.role === 'tool' && idx >= 1) {
    recent = state.messages.slice(idx, state.messages.length)
    idx -= 1
  }

  return [system, ...recent]
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, scenario } = await request.json()

    if (!sessionId || !scenario) {
      return new Response('Missing sessionId or scenario', { status: 400 })
    }

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return new Response('MISTRAL_API_KEY not configured', { status: 500 })
    }

    // Get or create conversation state
    let state = conversationStates.get(sessionId)
    if (!state) {
      state = {
        messages: [
          {
            role: 'system',
            content: getSystemPrompt(scenario),
          },
        ],
        scenario,
        extractedData: {},
      }
      conversationStates.set(sessionId, state)
    }

    // Add user message
    state.messages.push({
      role: 'user',
      content: message,
    })

    // Extract parameters from user message and merge
    const extracted = extractParameters(message)
    Object.assign(state.extractedData, extracted)

    // Get tools for scenario
    const tools = getAvailableTools(scenario)

    // Create streaming response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // First, make a non-streaming call to check for tool calls
          let initialResponse
          try {
            initialResponse = await callMistralAPI(buildContextMessages(state), tools, apiKey, false)
          } catch (err) {
            console.error('Mistral initial call failed:', err)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "I'm having trouble reaching the assistant. Please try again in a moment." })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            return
          }
          
          // Type guard: with stream=false, we should get MistralResponse
          if (initialResponse instanceof ReadableStream) {
            controller.error(new Error('Unexpected streaming response'))
            return
          }

          const response = initialResponse
          const assistantMessage = response.choices[0]?.message
          let fullResponse = ''

          // Check if we have tool calls
          let lastToolUsed: string | undefined

          if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
            // Add assistant message with tool calls first (correct ordering)
            state.messages.push({
              role: 'assistant',
              content: assistantMessage.content || '',
              tool_calls: assistantMessage.tool_calls,
            })

            // Execute all tool calls
            for (const toolCall of assistantMessage.tool_calls) {
              try {
                const args = JSON.parse(toolCall.function.arguments)
                const result = executeToolCall(toolCall.function.name, args, scenario)
                lastToolUsed = toolCall.function.name

                // Add tool result to messages
                state.messages.push({
                  role: 'tool',
                  content: JSON.stringify(result),
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                })

                // Store extracted data
                Object.assign(state.extractedData, args)
              } catch (error) {
                console.error(`Error executing tool ${toolCall.function.name}:`, error)
                // Add error to messages
                state.messages.push({
                  role: 'tool',
                  content: JSON.stringify({ error: 'Tool execution failed' }),
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                })
              }
            }

            // Get final response after tool execution (with streaming)
            let finalResponse
            try {
              finalResponse = await callMistralAPI(buildContextMessages(state), tools, apiKey, true)
            } catch (err) {
              console.error('Mistral final call failed:', err)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "The assistant hit a snag while calculating. Please rephrase or try again." })}\n\n`))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }
            if (finalResponse instanceof ReadableStream) {
              for await (const chunk of parseMistralStream(finalResponse)) {
                fullResponse += chunk
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, toolUsed: lastToolUsed })}\n\n`))
              }
            } else {
              // Fallback to non-streaming
              fullResponse = finalResponse.choices[0]?.message?.content || ''
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullResponse, toolUsed: lastToolUsed })}\n\n`))
            }
          } else {
            // Regular response without tool calls - stream it
            const content = assistantMessage?.content || ''
            fullResponse = content
            
            // Stream the content character by character for smooth effect
            for (let i = 0; i < content.length; i += 10) {
              const chunk = content.slice(i, i + 10)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, toolUsed: lastToolUsed })}\n\n`))
              // Small delay for smooth streaming effect
              await new Promise(resolve => setTimeout(resolve, 10))
            }
          }

          // Add final assistant message to state
          state.messages.push({
            role: 'assistant',
            content: fullResponse,
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Chat failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

