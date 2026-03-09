/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'bounce-gentle': 'bounceGentle 2.5s ease-in-out infinite',
        'pop-in':        'popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'wiggle':        'wiggle 0.55s ease-in-out',
        'float':         'float 3.5s ease-in-out infinite',
        'sparkle':       'sparkle 1.8s ease-in-out infinite',
        'celebrate':     'celebrate 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shimmer':       'shimmer 0.7s ease-in-out forwards',
      },
      keyframes: {
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.3) rotate(-8deg)' },
          '70%':  { transform: 'scale(1.08) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '20%':      { transform: 'rotate(-15deg) scale(1.15)' },
          '60%':      { transform: 'rotate(10deg) scale(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-7px)' },
        },
        sparkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
          '50%':      { opacity: '0.4', transform: 'scale(0.7) rotate(45deg)' },
        },
        celebrate: {
          '0%':   { transform: 'scale(1) rotate(0deg)' },
          '40%':  { transform: 'scale(1.4) rotate(-5deg)' },
          '70%':  { transform: 'scale(1.2) rotate(3deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        shimmer: {
          'from': { left: '-100%' },
          'to':   { left: '150%' },
        },
      },
    },
  },
  plugins: [],
}
