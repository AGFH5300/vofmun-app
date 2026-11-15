/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'font-thin',
    'font-extralight',
    'font-light',
    'font-normal',
    'font-medium',
    'font-semibold',
    'font-bold',
    'font-extrabold',
    'font-black',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Poppins", "Open Sans", "sans-serif"],
        serif: ["Merriweather", "Playfair Display", "Georgia", "serif"],
        body: ["Inter", "Poppins", "Open Sans", "sans-serif"],
        heading: ["Merriweather", "Playfair Display", "Georgia", "serif"],
      },
      colors: {
        // Primary Colors - VOFMUN branding
        'deep-red': '#701E1E',
        'dark-burgundy': '#8B2424',
        'primary-peach': '#FFEBDD',

        // Neutral Colors
        'almost-black-green': '#1C1C1C',
        'dark-navy': '#26262B',
        'cool-grey': '#E4D7CC',
        'warm-light-grey': '#FFFDFB',

        // Highlight / Support Colors
        'soft-rose': '#F6D4C6',
        'soft-ivory': '#FFEBDD',
        'pale-aqua': '#E0F1F4',
        'rich-gold': '#C79A3B',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'fade-in': 'fadeIn 0.5s ease-out',
        'bounce-soft': 'bounceSoft 2s infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};
