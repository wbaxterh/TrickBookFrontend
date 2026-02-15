/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind requires this preset
  presets: [require('nativewind/preset')],
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: {
          DEFAULT: '#FFD700',
          dark: '#E6C200',
          light: '#FFE44D',
        },
        secondary: {
          DEFAULT: '#1976D2',
          dark: '#1565C0',
          light: '#42A5F5',
        },
        // Semantic colors
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
        info: '#2196F3',
        premium: '#1DA1F2',
        // Status colors
        status: {
          notStarted: '#666666',
          learning: '#FF9800',
          landed: '#4CAF50',
          mastered: '#FFD700',
        },
        // Dark theme
        dark: {
          bg: '#121212',
          surface: '#1E1E1E',
          elevated: '#2C2C2C',
          border: '#333333',
        },
        // Light theme
        light: {
          bg: '#FFFFFF',
          surface: '#F5F5F5',
          elevated: '#EEEEEE',
          border: '#E0E0E0',
        },
      },
      fontFamily: {
        sans: ['System', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
