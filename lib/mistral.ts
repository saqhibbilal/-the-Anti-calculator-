/**
 * Mistral API integration with function calling support
 */

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_calls?: MistralToolCall[]
  tool_call_id?: string
}

export interface MistralToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface MistralTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

export interface MistralResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: MistralMessage
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL = 'mistral-large-latest' // Supports function calling

/**
 * Define available tools/functions for the AI
 */
export function getAvailableTools(scenario: 'buy-vs-rent' | 'refinance-check'): MistralTool[] {
  if (scenario === 'buy-vs-rent') {
    return [
      {
        type: 'function',
        function: {
          name: 'calculate_mortgage',
          description: 'Calculate mortgage details including EMI, loan amount, down payment, and upfront costs. Use this when you have property price and optionally down payment and tenure.',
          parameters: {
            type: 'object',
            properties: {
              propertyPrice: {
                type: 'number',
                description: 'The price of the property in AED',
              },
              downPayment: {
                type: 'number',
                description: 'Down payment amount in AED (optional, will default to 20% minimum)',
              },
              tenure: {
                type: 'number',
                description: 'Loan tenure in years (optional, defaults to 25 years max)',
              },
            },
            required: ['propertyPrice'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyze_buy_vs_rent',
          description: 'Compare buying vs renting and provide a recommendation based on stay duration, monthly rent, and property details.',
          parameters: {
            type: 'object',
            properties: {
              propertyPrice: {
                type: 'number',
                description: 'The price of the property in AED',
              },
              monthlyRent: {
                type: 'number',
                description: 'Current monthly rent in AED',
              },
              downPayment: {
                type: 'number',
                description: 'Down payment amount in AED (optional)',
              },
              stayDuration: {
                type: 'number',
                description: 'How long the user plans to stay in the UAE (in years)',
              },
              tenure: {
                type: 'number',
                description: 'Loan tenure in years (optional)',
              },
            },
            required: ['propertyPrice', 'monthlyRent', 'stayDuration'],
          },
        },
      },
    ]
  } else {
    // Refinance check tools
    return [
      {
        type: 'function',
        function: {
          name: 'calculate_refinance',
          description: 'Calculate if refinancing is worth it by comparing current mortgage costs with new mortgage costs including switching fees.',
          parameters: {
            type: 'object',
            properties: {
              currentLoanAmount: {
                type: 'number',
                description: 'Current outstanding loan amount in AED',
              },
              currentInterestRate: {
                type: 'number',
                description: 'Current annual interest rate as a decimal (e.g., 0.05 for 5%, 0.045 for 4.5%)',
              },
              currentTenure: {
                type: 'number',
                description: 'Remaining tenure in years',
              },
              newInterestRate: {
                type: 'number',
                description: 'New annual interest rate being offered as a decimal (e.g., 0.04 for 4%)',
              },
              switchingCosts: {
                type: 'number',
                description: 'Total switching costs in AED (fees, penalties, etc.)',
              },
            },
            required: ['currentLoanAmount', 'currentInterestRate', 'currentTenure', 'newInterestRate', 'switchingCosts'],
          },
        },
      },
    ]
  }
}

/**
 * Get system prompt based on scenario
 */
export function getSystemPrompt(scenario: 'buy-vs-rent' | 'refinance-check'): string {
  if (scenario === 'buy-vs-rent') {
    return `You are a friendly, empathetic financial advisor helping UAE homebuyers decide whether to buy or rent a property. 

Your role:
- Act like a "smart friend" - be conversational, understanding, and helpful
- Extract key information from vague user messages (property price, income, down payment, tenure, current rent, stay duration)
- Ask for missing information naturally, not like a robotic survey
- Use the provided tools to calculate accurate mortgage details
- Explain financial concepts in simple, relatable terms
- Warn users about hidden costs (7% upfront fees)
- Provide clear, personalized recommendations

UAE Mortgage Rules (CRITICAL - these are fixed):
- Maximum LTV: 80% (minimum 20% down payment)
- Upfront costs: 7% of property price (4% transfer fee + 2% agency fee + 1% misc)
- Standard interest rate: 4.5% annual
- Maximum tenure: 25 years

Buy vs Rent Logic:
- Stay < 3 years: Recommend renting (transaction costs too high)
- Stay > 5 years: Recommend buying (equity buildup)
- 3-5 years: Show both options, let user decide

Always use the calculation tools - NEVER guess or estimate numbers. Be accurate and trustworthy.`
  } else {
    return `You are a friendly, empathetic financial advisor helping UAE homeowners evaluate mortgage refinancing options.

Your role:
- Act like a "smart friend" - be conversational, understanding, and helpful
- Extract key information about their current mortgage and the new offer
- Calculate if refinancing makes financial sense considering switching costs
- Explain the break-even point and long-term savings
- Help users make informed decisions

Always use the calculation tools - NEVER guess or estimate numbers. Be accurate and trustworthy.`
  }
}

/**
 * Call Mistral API with streaming support
 */
export async function callMistralAPI(
  messages: MistralMessage[],
  tools: MistralTool[],
  apiKey: string,
  stream: boolean = true
): Promise<ReadableStream<Uint8Array> | MistralResponse> {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      stream,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mistral API error: ${response.status} ${error}`)
  }

  if (stream) {
    return response.body!
  } else {
    return (await response.json()) as MistralResponse
  }
}

/**
 * Parse streaming response from Mistral
 */
export async function* parseMistralStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }

            // Check for tool calls
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls
            if (toolCalls) {
              // Tool calls will be handled separately
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

