'use client'

import { Scenario } from '@/app/page'

interface ScenarioSelectorProps {
  onSelect: (scenario: Scenario) => void
}

export default function ScenarioSelector({ onSelect }: ScenarioSelectorProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-bg-primary">
      <div className="w-full max-w-2xl">
        <h1 className="text-6xl font-bold text-center mb-20 tracking-tight text-[#E4D4B2]">
          ANTI - CALCULATOR
        </h1>

        <div className="space-y-5">
          <button
            onClick={() => onSelect('buy-vs-rent')}
            className="w-full p-8 text-left rounded-2xl border-2 border-transparent hover:border-accent/30 transition-all duration-200 bg-bg-secondary text-bg-primary hover:bg-opacity-95 active:scale-[0.98]"
          >
            <div className="text-2xl font-bold mb-2">Buy vs. Rent</div>
            <div className="text-base opacity-70 font-normal">
              Help decide if you should stop renting and buy a home based on your finances
            </div>
          </button>

          <button
            onClick={() => onSelect('refinance-check')}
            className="w-full p-8 text-left rounded-2xl border-2 border-transparent hover:border-accent/30 transition-all duration-200 bg-bg-secondary text-bg-primary hover:bg-opacity-95 active:scale-[0.98]"
          >
            <div className="text-2xl font-bold mb-2">The Refinance Check</div>
            <div className="text-base opacity-70 font-normal">
              Decide if switching your current mortgage to a new rate is worth the switching costs
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

