/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#1B4FD8',
        'primary-dark': '#1440B0',
        secondary: '#F59E0B',
        surface: '#F8FAFC',
        muted: '#94A3B8',
      },
    },
  },
  plugins: [],
};
