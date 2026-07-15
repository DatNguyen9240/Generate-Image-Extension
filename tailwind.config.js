/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#090a0d',
        panel: '#111319',
        line: '#252832',
        muted: '#9399a8',
        accent: '#7c6df2',
      },
      boxShadow: { glow: '0 0 30px rgba(124,109,242,.16)' },
    },
  },
  plugins: [],
};
