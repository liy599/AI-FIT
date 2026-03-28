/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 40px rgba(99,102,241,0.35)'
      },
      backgroundImage: {
        'hero-gradient':
          'radial-gradient(1200px circle at var(--mx, 50%) var(--my, 50%), rgba(99,102,241,0.25), transparent 55%), radial-gradient(900px circle at 20% 10%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(800px circle at 80% 20%, rgba(236,72,153,0.18), transparent 55%)'
      }
    }
  },
  plugins: []
}

