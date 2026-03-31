/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        base: '#12151C',
        'base-light': '#1a1f2e',
        'base-card': '#1e2433',
        primary: '#078d70',
        'primary-dark': '#056b55',
        'primary-hover': '#0aa882',
        'accent-green': '#98e8c1',
        'accent-blue': '#7bade2',
        'accent-purple': '#3d1a78',
        'accent-purple-light': '#5a2aad'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
        'pulse-gentle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: []
}
