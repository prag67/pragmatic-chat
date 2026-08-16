/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0E1A', 50: '#F0F1F3', 100: '#E1E4E8', 800: '#1A2233', 900: '#0A0E1A' },
        sand: { DEFAULT: '#F8F7F4', 100: '#F2F0E9', 200: '#E8E4D9', 300: '#DDD8C7' },
        jade: { DEFAULT: '#0E9384', 50: '#E6F7F5', 100: '#CCEFEB', 500: '#0E9384', 600: '#0C7D70', 700: '#0A665B' },
        plum: { DEFAULT: '#7C3AED', 50: '#F3EDFF', 500: '#7C3AED', 600: '#6D28D9' },
        mist: { DEFAULT: '#EEF2F6', 500: '#94A3B8' },
      },
      fontFamily: {
        sans: ['Prompt','Noto Sans Thai','Inter','system-ui','sans-serif'],
        display: ['Space Grotesk','Prompt','sans-serif'],
        mono: ['JetBrains Mono','monospace'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        soft: '0 2px 16px rgba(10,14,26,0.06)',
        lifted: '0 8px 30px rgba(10,14,26,0.10)',
        glow: '0 0 0 3px rgba(14,147,132,0.15)',
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.2s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
