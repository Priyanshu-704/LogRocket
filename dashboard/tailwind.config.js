/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f6f6f9',
          100: '#eef0f5',
          200: '#d5dae7',
          300: '#b1b9d2',
          400: '#8693b7',
          500: '#6474a2',
          600: '#4e5b87',
          700: '#3f496d',
          800: '#262c42',
          900: '#1a1e2d',
          950: '#0e1017',
        }
      }
    },
  },
  plugins: [],
};
