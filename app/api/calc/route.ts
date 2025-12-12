import { NextRequest, NextResponse } from 'next/server'
import {
  calculateMortgage,
  analyzeBuyVsRent,
  calculateEMI,
  type MortgageInputs,
  type BuyVsRentInputs,
} from '@/lib/math'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, inputs } = body

    switch (type) {
      case 'mortgage': {
        const mortgageInputs = inputs as MortgageInputs
        const result = calculateMortgage(mortgageInputs)
        return NextResponse.json({ success: true, data: result })
      }

      case 'buy-vs-rent': {
        const buyVsRentInputs = inputs as BuyVsRentInputs
        const result = analyzeBuyVsRent(buyVsRentInputs)
        return NextResponse.json({ success: true, data: result })
      }

      case 'emi': {
        const { loanAmount, interestRate, tenure } = inputs
        const emi = calculateEMI(loanAmount, interestRate, tenure)
        return NextResponse.json({ success: true, data: { emi } })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid calculation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Calculation error:', error)
    return NextResponse.json(
      { success: false, error: 'Calculation failed' },
      { status: 500 }
    )
  }
}

