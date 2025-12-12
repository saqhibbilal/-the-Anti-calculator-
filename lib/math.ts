/**
 * Deterministic math functions for mortgage calculations
 * These functions ensure accurate calculations without LLM hallucinations
 */

// UAE Mortgage Constants
export const UAE_CONSTANTS = {
  MAX_LTV: 0.80, // 80% max loan-to-value
  MIN_DOWN_PAYMENT: 0.20, // 20% minimum down payment
  UPFRONT_COST_PERCENTAGE: 0.07, // 7% upfront costs (4% transfer + 2% agency + 1% misc)
  INTEREST_RATE: 0.045, // 4.5% annual interest rate
  MAX_TENURE: 25, // 25 years maximum tenure
} as const

export interface MortgageInputs {
  propertyPrice: number
  downPayment?: number
  tenure?: number // in years
  interestRate?: number // annual rate, defaults to 4.5%
}

export interface MortgageCalculation {
  propertyPrice: number
  downPayment: number
  loanAmount: number
  ltv: number
  upfrontCosts: number
  totalUpfront: number
  emi: number
  tenure: number
  interestRate: number
}

export interface BuyVsRentInputs {
  propertyPrice: number
  monthlyRent: number
  downPayment?: number
  tenure?: number
  stayDuration?: number // years user plans to stay
  interestRate?: number
}

export interface BuyVsRentAnalysis {
  recommendation: 'buy' | 'rent' | 'neutral'
  reasoning: string
  monthlyEMI: number
  monthlyRent: number
  upfrontCosts: number
  stayDuration: number
  breakEvenYears?: number
}

/**
 * Calculate EMI (Equated Monthly Installment) using standard mortgage formula
 * EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]
 * Where:
 * P = Principal (loan amount)
 * R = Monthly interest rate (annual rate / 12)
 * N = Number of monthly installments (tenure in years * 12)
 */
export function calculateEMI(
  loanAmount: number,
  annualInterestRate: number = UAE_CONSTANTS.INTEREST_RATE,
  tenureYears: number = UAE_CONSTANTS.MAX_TENURE
): number {
  if (loanAmount <= 0) return 0
  if (tenureYears <= 0) return 0
  if (annualInterestRate < 0) return 0

  const monthlyRate = annualInterestRate / 12
  const numberOfMonths = tenureYears * 12

  if (monthlyRate === 0) {
    return loanAmount / numberOfMonths
  }

  const emi =
    (loanAmount *
      monthlyRate *
      Math.pow(1 + monthlyRate, numberOfMonths)) /
    (Math.pow(1 + monthlyRate, numberOfMonths) - 1)

  return Math.round(emi * 100) / 100 // Round to 2 decimal places
}

/**
 * Calculate maximum loan amount based on LTV
 */
export function calculateMaxLoanAmount(propertyPrice: number): number {
  return propertyPrice * UAE_CONSTANTS.MAX_LTV
}

/**
 * Calculate minimum down payment
 */
export function calculateMinDownPayment(propertyPrice: number): number {
  return propertyPrice * UAE_CONSTANTS.MIN_DOWN_PAYMENT
}

/**
 * Calculate upfront costs (7% of property price)
 */
export function calculateUpfrontCosts(propertyPrice: number): number {
  return propertyPrice * UAE_CONSTANTS.UPFRONT_COST_PERCENTAGE
}

/**
 * Calculate total upfront payment (down payment + upfront costs)
 */
export function calculateTotalUpfront(
  propertyPrice: number,
  downPayment: number
): number {
  return downPayment + calculateUpfrontCosts(propertyPrice)
}

/**
 * Calculate LTV (Loan-to-Value) ratio
 */
export function calculateLTV(
  propertyPrice: number,
  downPayment: number
): number {
  if (propertyPrice <= 0) return 0
  const loanAmount = propertyPrice - downPayment
  return loanAmount / propertyPrice
}

/**
 * Validate down payment meets minimum requirement
 */
export function validateDownPayment(
  propertyPrice: number,
  downPayment: number
): { valid: boolean; minRequired: number; actual: number } {
  const minRequired = calculateMinDownPayment(propertyPrice)
  return {
    valid: downPayment >= minRequired,
    minRequired,
    actual: downPayment,
  }
}

/**
 * Complete mortgage calculation
 */
export function calculateMortgage(
  inputs: MortgageInputs
): MortgageCalculation {
  const {
    propertyPrice,
    downPayment: providedDownPayment,
    tenure = UAE_CONSTANTS.MAX_TENURE,
    interestRate = UAE_CONSTANTS.INTEREST_RATE,
  } = inputs

  // Ensure tenure doesn't exceed max
  const finalTenure = Math.min(tenure, UAE_CONSTANTS.MAX_TENURE)

  // Calculate or validate down payment
  let downPayment = providedDownPayment || calculateMinDownPayment(propertyPrice)
  const minDownPayment = calculateMinDownPayment(propertyPrice)
  if (downPayment < minDownPayment) {
    downPayment = minDownPayment
  }

  // Calculate loan amount
  const loanAmount = propertyPrice - downPayment

  // Ensure loan doesn't exceed max LTV
  const maxLoan = calculateMaxLoanAmount(propertyPrice)
  if (loanAmount > maxLoan) {
    const adjustedDownPayment = propertyPrice - maxLoan
    downPayment = adjustedDownPayment
    const adjustedLoanAmount = maxLoan
    return {
      propertyPrice,
      downPayment: adjustedDownPayment,
      loanAmount: adjustedLoanAmount,
      ltv: UAE_CONSTANTS.MAX_LTV,
      upfrontCosts: calculateUpfrontCosts(propertyPrice),
      totalUpfront: calculateTotalUpfront(propertyPrice, adjustedDownPayment),
      emi: calculateEMI(adjustedLoanAmount, interestRate, finalTenure),
      tenure: finalTenure,
      interestRate,
    }
  }

  const ltv = calculateLTV(propertyPrice, downPayment)
  const upfrontCosts = calculateUpfrontCosts(propertyPrice)
  const totalUpfront = calculateTotalUpfront(propertyPrice, downPayment)
  const emi = calculateEMI(loanAmount, interestRate, finalTenure)

  return {
    propertyPrice,
    downPayment,
    loanAmount,
    ltv,
    upfrontCosts,
    totalUpfront,
    emi,
    tenure: finalTenure,
    interestRate,
  }
}

/**
 * Buy vs Rent analysis
 * Logic:
 * - Stay < 3 years: Advise Renting (transaction fees kill profit)
 * - Stay > 5 years: Advise Buying (equity buildup beats rent)
 * - 3-5 years: Neutral/show both options
 */
export function analyzeBuyVsRent(
  inputs: BuyVsRentInputs
): BuyVsRentAnalysis {
  const {
    propertyPrice,
    monthlyRent,
    downPayment,
    tenure = UAE_CONSTANTS.MAX_TENURE,
    stayDuration = 5,
    interestRate = UAE_CONSTANTS.INTEREST_RATE,
  } = inputs

  // Calculate mortgage details
  const mortgage = calculateMortgage({
    propertyPrice,
    downPayment,
    tenure,
    interestRate,
  })

  let recommendation: 'buy' | 'rent' | 'neutral'
  let reasoning: string

  if (stayDuration < 3) {
    recommendation = 'rent'
    reasoning = `Since you plan to stay less than 3 years, renting is typically better. The upfront costs (${mortgage.upfrontCosts.toLocaleString()} AED) and transaction fees would likely outweigh any potential gains in such a short period.`
  } else if (stayDuration > 5) {
    recommendation = 'buy'
    reasoning = `With a stay duration of over 5 years, buying makes more sense. You'll build equity over time, and the monthly mortgage payment (${mortgage.emi.toLocaleString()} AED) compared to rent (${monthlyRent.toLocaleString()} AED) will work in your favor long-term.`
  } else {
    recommendation = 'neutral'
    reasoning = `With a stay duration of 3-5 years, it's a close call. Consider your financial flexibility, market conditions, and personal circumstances. Monthly mortgage: ${mortgage.emi.toLocaleString()} AED vs Rent: ${monthlyRent.toLocaleString()} AED.`
  }

  return {
    recommendation,
    reasoning,
    monthlyEMI: mortgage.emi,
    monthlyRent,
    upfrontCosts: mortgage.upfrontCosts,
    stayDuration,
  }
}

