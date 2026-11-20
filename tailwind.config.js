/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B2340',
          deep: '#0A2A66',
          ink: '#071A31',
        },
        sky: {
          DEFAULT: '#29A7E1',
          soft: '#3FA9E0',
          light: '#E4F3FB',
        },
        surface: '#F4F7FB',
        line: '#D8E3F0',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,35,64,0.06), 0 8px 24px -12px rgba(11,35,64,0.18)',
        sheet: '0 10px 40px -12px rgba(11,35,64,0.35)',
      },
    },
  },
  plugins: [],
};
