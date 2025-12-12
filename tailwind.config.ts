import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1A1B2F',
        'bg-secondary': '#E4D4B2',
        'accent': '#047877',
      },
      fontFamily: {
        lexend: ['var(--font-lexend)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

