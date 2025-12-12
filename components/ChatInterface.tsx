'use client'

import { useState, useRef, useEffect } from 'react'
import { Scenario } from '@/app/page'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  scenario: Scenario
}

// Generate session ID (persists for this browser session)
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sessionId = sessionStorage.getItem('chat_session_id')
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('chat_session_id', sessionId)
  }
  return sessionId
}

export default function ChatInterface({ scenario }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: scenario === 'buy-vs-rent' 
        ? "Marhaba! 👋 Welcome to your friendly neighborhood property advisor (minus the awkward small talk at the coffee shop).\n\nI'm here to help you figure out whether buying or renting makes more sense for your situation. Think of me as that friend who actually understands mortgages and won't judge you for asking 'dumb' questions.\n\nSo, what's on your mind? Are you eyeing a place in Dubai Marina? Thinking about JLT? Or just curious if your salary can handle that dream apartment? Tell me what you're working with!"
        : "Marhaba! 👋 Ready to see if refinancing your mortgage is actually worth the hassle (and those pesky switching fees)?\n\nI'm here to do the math so you don't have to. No judgment, no sales pitch—just honest numbers about whether switching will save you money or just give you a headache.\n\nWhat's your current situation? Let's see if refinancing makes sense for you!"
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => getSessionId())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          scenario,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      let assistantMessageIndex = messages.length + 1 // Index of the empty assistant message we just added

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setIsLoading(false)
              return
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                setMessages(prev => {
                  const updated = [...prev]
                  if (updated[assistantMessageIndex]) {
                    updated[assistantMessageIndex] = {
                      ...updated[assistantMessageIndex],
                      content: updated[assistantMessageIndex].content + parsed.content,
                    }
                  } else {
                    updated.push({ role: 'assistant', content: parsed.content })
                  }
                  return updated
                })
                scrollToBottom()
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      setIsLoading(false)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return
      }
      console.error('Chat error:', error)
      setMessages(prev => {
        const updated = [...prev]
        // Remove the empty assistant message and add error message
        updated.pop()
        updated.push({
          role: 'assistant',
          content: "I'm sorry, I encountered an error. Please try again or check your connection.",
        })
        return updated
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="border-b border-accent/10 px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight">ANTI - CALCULATOR</h1>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-10 space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-6 py-4 ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-bg-primary'
              }`}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-normal">
                {message.content}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-bg-secondary text-bg-primary rounded-2xl px-6 py-4">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-accent/10 px-8 py-6 bg-bg-primary">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-4 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Type your message..."
              className="flex-1 bg-bg-secondary/5 border border-accent/20 rounded-xl px-5 py-4 text-[#E4D4B2] placeholder-[#E4D4B2]/40 resize-none focus:outline-none focus:border-accent/40 focus:bg-bg-secondary/8 transition-all text-[15px] font-normal"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-8 py-4 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-[15px]"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

