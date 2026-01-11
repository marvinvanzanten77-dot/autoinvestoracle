/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#8FB9B6',
        accent: '#BFA98B',
        bg: {
          DEFAULT: '#0B1117',
          dark: '#0F1720'
        },
        card: '#111827'
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', '"DM Sans"', 'sans-serif']
      },
      fontSize: {
        title: ['1.75rem', { lineHeight: '1.2', fontWeight: '600' }],
        subtitle: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        label: ['0.85rem', { letterSpacing: '0.04em', textTransform: 'uppercase' }],
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
