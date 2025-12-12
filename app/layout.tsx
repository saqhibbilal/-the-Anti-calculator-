import type { Metadata } from 'next'
import { Lexend_Deca } from 'next/font/google'
import './globals.css'

const lexendDeca = Lexend_Deca({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lexend',
})

export const metadata: Metadata = {
  title: 'ANTI - CALCULATOR',
  description: 'AI-powered conversational assistant for UAE homebuyers',
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

