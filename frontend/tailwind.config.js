/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'midnight': '#0f172a',
        'deep-blue': '#1e293b',
        'accent': '#f59e0b',
        'accent-light': '#fbbf24',
        'soft-white': '#f8fafc',
        'muted': '#94a3b8',
      },
      fontFamily: {
        'display': ['Outfit', 'sans-serif'],
        'body': ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

