import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0D1B3E',
          surface: '#162249',
          'surface-hover': '#1e2d5e',
          border: '#1e2d5e',
        },
        accent: {
          DEFAULT: '#42D1B9',
          hover: '#56DEC8',
          muted: 'rgba(66, 209, 185, 0.15)',
        },
        brand: {
          navy: '#162249',
          'navy-hover': '#1e2d6b',
          teal: '#42D1B9',
          'teal-dark': '#2ABBA4',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse_glow: {
          '0%, 100%': { boxShadow: '0 0 4px rgba(66, 209, 185, 0.4)' },
          '50%': { boxShadow: '0 0 12px rgba(66, 209, 185, 0.7)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        slideUp: 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulse_glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
