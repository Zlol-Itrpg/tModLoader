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
      fontFamily: {
        // Display serif for headlines, condensed caps for labels and buttons.
        display: ['"Playfair Display"', 'Georgia', 'ui-serif', 'serif'],
        stencil: ['"Oswald"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
