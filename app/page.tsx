'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import ScenarioSelector from '@/components/ScenarioSelector'

export type Scenario = 'buy-vs-rent' | 'refinance-check' | null

export default function Home() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(null)

  if (!selectedScenario) {
    return <ScenarioSelector onSelect={setSelectedScenario} />
  }

  return <ChatInterface scenario={selectedScenario} />
}

