/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rafiki: {
          50: '#fff8f1',
          100: '#feecdc',
          200: '#fcd5b5',
          300: '#faaf80',
          400: '#f68047',
          500: '#f25a1b',
          600: '#e33e10',
          700: '#bc2c10',
          800: '#952514',
          900: '#782214',
          950: '#410d08',
        }
      }
    },
  },
  plugins: [],
}
