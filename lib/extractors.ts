/**
 * Lightweight regex-based parameter extraction from user messages.
 * This is NOT authoritative; we still rely on tools for math and validation.
 */

export interface ExtractedParams {
  propertyPrice?: number
  income?: number
  downPayment?: number
  tenure?: number
  monthlyRent?: number
  stayDuration?: number
}

// Convert strings like "2M", "1.5m", "500k" to numbers
function parseNumberWithSuffix(value: string): number | undefined {
  const lower = value.toLowerCase()
  const mul = lower.endsWith('m') ? 1_000_000 : lower.endsWith('k') ? 1_000 : 1
  const numeric = parseFloat(lower.replace(/[,mk]/g, ''))
  if (Number.isNaN(numeric)) return undefined
  return numeric * mul
}

export function extractParameters(message: string): ExtractedParams {
  const text = message

  const params: ExtractedParams = {}

  // Property price / amounts
  const priceMatch = text.match(/(\d[\d,.]*\s*[mk]?)(?=\s*(aed|dh|dirham|property|apartment|villa|flat|price|cost))/i)
  if (priceMatch) {
    const val = parseNumberWithSuffix(priceMatch[1])
    if (val && val > 0) params.propertyPrice = val
  }

  // Income (monthly)
  const incomeMatch = text.match(/(\d[\d,.]*\s*[mk]?)(?=\s*(aed)?\s*(\/month|per month|monthly|income|salary))/i)
  if (incomeMatch) {
    const val = parseNumberWithSuffix(incomeMatch[1])
    if (val && val > 0) params.income = val
  }

  // Down payment
  const downMatch = text.match(/(\d[\d,.]*\s*[mk]?)(?=\s*(aed)?\s*(down|dp|downpayment|down payment))/i)
  if (downMatch) {
    const val = parseNumberWithSuffix(downMatch[1])
    if (val && val > 0) params.downPayment = val
  }

  // Rent
  const rentMatch = text.match(/(\d[\d,.]*\s*[mk]?)(?=\s*(aed)?\s*(rent|rental|lease))/i)
  if (rentMatch) {
    const val = parseNumberWithSuffix(rentMatch[1])
    if (val && val > 0) params.monthlyRent = val
  }

  // Tenure (years)
  const tenureMatch = text.match(/(\d+(\.\d+)?)(?=\s*(year|years|yrs|y)\b)/i)
  if (tenureMatch) {
    const val = parseFloat(tenureMatch[1])
    if (val && val > 0) params.tenure = val
  }

  // Stay duration (years)
  const stayMatch = text.match(/(\d+(\.\d+)?)(?=\s*(year|years|yrs|y)\b.*(stay|staying|live|living))/i)
  if (stayMatch) {
    const val = parseFloat(stayMatch[1])
    if (val && val > 0) params.stayDuration = val
  }

  return params
}

