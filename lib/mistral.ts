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
          description:
            'Calculate mortgage details (loan amount, LTV, EMI, upfront costs). Call this whenever the user mentions a property price. Inputs: propertyPrice (required), downPayment (optional, AED), tenure (optional, years). Example: { "propertyPrice": 1500000, "downPayment": 300000, "tenure": 25 }',
          parameters: {
            type: 'object',
            properties: {
              propertyPrice: {
                type: 'number',
                description: 'The price of the property in AED (required)',
              },
              downPayment: {
                type: 'number',
                description: 'Down payment amount in AED (optional; default minimum is 20%)',
              },
              tenure: {
                type: 'number',
                description: 'Loan tenure in years (optional; max 25)',
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
          description:
            'Compare buying vs renting and return a recommendation. Call this when you have propertyPrice, monthlyRent, and stayDuration. Optional: downPayment, tenure. Example: { "propertyPrice": 1500000, "monthlyRent": 8000, "stayDuration": 5, "downPayment": 300000, "tenure": 25 }',
          parameters: {
            type: 'object',
            properties: {
              propertyPrice: {
                type: 'number',
                description: 'The price of the property in AED (required)',
              },
              monthlyRent: {
                type: 'number',
                description: 'Current monthly rent in AED (required)',
              },
              downPayment: {
                type: 'number',
                description: 'Down payment amount in AED (optional)',
              },
              stayDuration: {
                type: 'number',
                description: 'How long the user plans to stay in the UAE (years, required)',
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
          description:
            'Calculate if refinancing is worth it by comparing current EMI vs new EMI and switching costs. Call when user provides currentLoanAmount, currentInterestRate, currentTenure, newInterestRate, switchingCosts.',
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
    return `You are a precise UAE mortgage assistant. Follow ONLY the provided primitives. No extra banking rules, no DTI, no job stability advice, no guesses.

Primitives (fixed):
- Max LTV: 80% (min 20% down)
- Upfront costs: 7% of property price
- Interest: 4.5% annual
- Max tenure: 25 years
- Buy vs rent heuristic: stay <3 years → rent, >5 years → buy, else present both

Tool usage (mandatory):
- If user provides or implies property price, rent, stay duration, down payment, or tenure, call the appropriate tool. Never compute manually, never assume.
- Use calculate_mortgage when propertyPrice is provided (optional downPayment, tenure).
- Use analyze_buy_vs_rent when propertyPrice, monthlyRent, stayDuration are provided (optional downPayment, tenure).
- If parameters are missing, ask briefly for the missing ones, then call the tool.

Style:
- No jokes, no emojis, no metaphors, no personality.
- No markdown formatting (no bold/italics/headings/bullets) unless explicitly asked.
- Structure every answer:
  1) One-sentence summary.
  2) Short, clear list of numbers/findings (plain text, concise).
  3) One optional next step: "Let me know if you want to adjust any value."
- Be concise, direct, and factual.`
  } else {
    return `You are a precise UAE refinancing assistant. Use only the provided primitives. No extra banking rules, no DTI, no job stability advice, no guesses.

Tool usage (mandatory):
- If user mentions loan amount, current rate, new rate, tenure, or switching costs, call calculate_refinance. Never compute manually.
- If parameters are missing, ask briefly for the missing ones, then call the tool.

Style:
- No jokes, no emojis, no metaphors, no personality.
- No markdown formatting (no bold/italics/headings/bullets) unless explicitly asked.
- Structure every answer:
  1) One-sentence summary.
  2) Short, clear list of numbers/findings (plain text, concise).
  3) One optional next step: "Let me know if you want to adjust any value."
- Be concise, direct, and factual.`
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

