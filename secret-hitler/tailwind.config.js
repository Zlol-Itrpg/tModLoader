/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 1930s printing: cheap paper, heavy ink, three party colours.
        ink: '#141210',
        soot: '#241f1b',
        parchment: '#e6dac0',
        paper: '#f4ecd8',
        brass: '#a8873f',
        liberal: '#2e6f7d',
        fascist: '#8f5124',
        gold: '#c9a227',
        communist: '#9c1f1c',
      },
      keyframes: {
        // A card turning face up. Paired with .perspective-* on the parent.
        'flip-in': {
          '0%': { transform: 'rotateY(-92deg) scale(0.94)', opacity: '0' },
          '60%': { transform: 'rotateY(8deg) scale(1.01)', opacity: '1' },
          '100%': { transform: 'rotateY(0deg) scale(1)', opacity: '1' },
        },
        // The policy slam: a card dropping onto its slot from above.
        slam: {
          '0%': { transform: 'translateY(-140%) scale(1.6) rotate(-8deg)', opacity: '0' },
          '55%': { transform: 'translateY(0) scale(1.18) rotate(2deg)', opacity: '1' },
          '75%': { transform: 'translateY(0) scale(0.94) rotate(0deg)' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: '1' },
        },
        // The board taking the hit.
        'shake-x': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-4px)' },
          '30%': { transform: 'translateX(4px)' },
          '45%': { transform: 'translateX(-3px)' },
          '60%': { transform: 'translateX(3px)' },
          '80%': { transform: 'translateX(-1px)' },
        },
        // The interstitial curtain.
        'curtain-in': {
          '0%': { opacity: '0', transform: 'translateY(1.25rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(0.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Game-over flourishes.
        shimmer: {
          '0%': { backgroundPosition: '-160% 0' },
          '100%': { backgroundPosition: '260% 0' },
        },
        'stamp-in': {
          '0%': { transform: 'scale(2.6) rotate(-16deg)', opacity: '0' },
          '65%': { transform: 'scale(0.92) rotate(-8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        burst: {
          '0%': { transform: 'scale(0.2) rotate(0deg)', opacity: '0.9' },
          '100%': { transform: 'scale(2.4) rotate(35deg)', opacity: '0' },
        },
        'ribbon-in': {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)', opacity: '0' },
          '100%': { transform: 'translateX(0) skewX(-12deg)', opacity: '1' },
        },
        'split-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'split-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'pulse-heart': {
          '0%, 100%': { transform: 'scale(1)' },
          '12%': { transform: 'scale(1.035)' },
          '24%': { transform: 'scale(1)' },
          '36%': { transform: 'scale(1.02)' },
        },
      },
      animation: {
        'flip-in': 'flip-in 420ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        slam: 'slam 520ms cubic-bezier(0.3, 1.4, 0.4, 1) both',
        'shake-x': 'shake-x 380ms ease-in-out',
        'curtain-in': 'curtain-in 260ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        'fade-up': 'fade-up 300ms ease-out both',
        shimmer: 'shimmer 2.4s ease-in-out infinite',
        'stamp-in': 'stamp-in 480ms cubic-bezier(0.2, 1.5, 0.4, 1) both',
        burst: 'burst 1.4s ease-out infinite',
        'ribbon-in': 'ribbon-in 520ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
        'split-left': 'split-left 480ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
        'split-right': 'split-right 480ms cubic-bezier(0.2, 0.8, 0.3, 1) both',
        'pulse-heart': 'pulse-heart 1.6s ease-in-out infinite',
      },
      fontFamily: {
        // Display serif for headlines, condensed caps for labels and buttons.
        display: ['"Playfair Display"', 'Georgia', 'ui-serif', 'serif'],
        stencil: ['"Oswald"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
