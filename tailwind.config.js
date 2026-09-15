/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: {
          950: '#0A2E31',
          900: '#0F5257',
          800: '#146A70',
          700: '#1A8189',
        },
        gold: {
          400: '#E8A33D',
          500: '#D68F27',
        },
        paper: '#F7F5F0',
        ink: '#1B2430',
        slate: {
          400: '#8A97A0',
          500: '#5B6B73',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 82, 87, 0.06), 0 4px 16px rgba(15, 82, 87, 0.06)',
      },
    },
  },
  plugins: [],
}
