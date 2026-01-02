/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#46F0FF',
        accent: '#7B4DFF',
        bg: {
          DEFAULT: '#020816',
          dark: '#050B1E'
        },
        card: '#0B1224'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif']
      },
      fontSize: {
        title: ['1.75rem', { lineHeight: '1.2', fontWeight: '600' }],
        subtitle: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        label: ['0.85rem', { letterSpacing: '0.04em', textTransform: 'uppercase' }],
        value: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        muted: ['0.9rem', { lineHeight: '1.5', color: 'rgba(255,255,255,0.7)' }]
      },
      boxShadow: {
        glow: '0 25px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(70,240,255,0.08)'
      }
    }
  },
  plugins: []
};
