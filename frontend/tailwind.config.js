/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['16px', { lineHeight: '24px' }],      // Reduced from 20px
        '2xl': ['18px', { lineHeight: '28px' }],     // Reduced from 24px
        '3xl': ['20px', { lineHeight: '28px' }],     // Reduced from 30px
        '4xl': ['22px', { lineHeight: '32px' }],     // Reduced from 36px
        '5xl': ['24px', { lineHeight: '36px' }],     // Reduced from 48px
      }
    }
  }
}
