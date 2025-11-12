/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        dogica: ['"Dogica"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
