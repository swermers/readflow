import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        swissRed: '#FF4E4E',
        swissOffWhite: '#F5F5F0',
        swissBlack: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'], // Simple start
      }
    },
  },
  plugins: [],
};
export default config;