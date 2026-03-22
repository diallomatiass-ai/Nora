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
          bg: '#0A1829',
          surface: '#122B4A',
          'surface-hover': '#1a3660',
          border: '#1a3660',
        },
        accent: {
          DEFAULT: '#0CA9BA',
          hover: '#3DBFCC',
          muted: 'rgba(12, 169, 186, 0.15)',
        },
        brand: {
          navy: '#122B4A',
          'navy-hover': '#1a3660',
          teal: '#0CA9BA',
          'teal-dark': '#0A95A6',
          'teal-light': '#3DBFCC',
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
          '0%, 100%': { boxShadow: '0 0 4px rgba(12, 169, 186, 0.4)' },
          '50%': { boxShadow: '0 0 12px rgba(12, 169, 186, 0.7)' },
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
