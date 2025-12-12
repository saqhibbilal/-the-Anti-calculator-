import type { Metadata } from 'next'
import { Lexend_Deca } from 'next/font/google'
import './globals.css'

const lexendDeca = Lexend_Deca({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lexend',
})

export const metadata: Metadata = {
  title: '🇦🇪 ANTI - CALCULATOR',
  description: 'AI-powered conversational assistant for UAE homebuyers',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🇦🇪</text></svg>',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={lexendDeca.variable}>{children}</body>
    </html>
  )
}

