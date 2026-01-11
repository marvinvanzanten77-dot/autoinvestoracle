/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6FA8A1',
        accent: '#E3C8A2',
        bg: {
          DEFAULT: '#F6F3ED',
          dark: '#EFE9DF'
        },
        card: '#F9F7F2'
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader"', 'serif']
      },
      fontSize: {
        title: ['1.5rem', { lineHeight: '1.25', fontWeight: '600' }],
        subtitle: ['1.15rem', { lineHeight: '1.5', fontWeight: '600' }],
        label: ['0.85rem', { letterSpacing: '0.02em' }],
        value: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        muted: ['0.9rem', { lineHeight: '1.5', color: 'rgba(255,255,255,0.7)' }]
      },
      boxShadow: {
        glow: '0 25px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(143,185,182,0.08)'
      }
    }
  },
  plugins: []
};
