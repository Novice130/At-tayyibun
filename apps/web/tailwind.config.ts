import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        gold: {
          50: '#FBF8E8',
          100: '#F7F0D1',
          200: '#EFE1A3',
          300: '#E7D275',
          400: '#DFC347',
          500: '#D4AF37', // Primary gold
          600: '#B8962F',
          700: '#8B7023',
          800: '#5E4B18',
          900: '#31270C',
        },
        purple: {
          50: '#F5E9F5',
          100: '#EBD3EB',
          200: '#D7A7D7',
          300: '#C37BC3',
          400: '#AF4FAF',
          500: '#4A0E4E', // Deep purple
          600: '#3E0C41',
          700: '#320A35',
          800: '#260728',
          900: '#1A051C',
        },
        // Semantic colors
        primary: '#D4AF37',
        secondary: '#4A0E4E',
        accent: '#8B5CF6',
        background: '#0F0F1A',
        surface: '#1A1A2E',
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #8B7500 100%)',
        'gradient-purple': 'linear-gradient(135deg, #4A0E4E 0%, #2D0830 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 100%)',
        'gradient-glow': 'radial-gradient(circle at center, rgba(212, 175, 55, 0.1) 0%, transparent 70%)',
      },
      boxShadow: {
        'gold': '0 4px 20px rgba(212, 175, 55, 0.3)',
        'purple': '0 4px 20px rgba(74, 14, 78, 0.3)',
        'glow': '0 0 30px rgba(212, 175, 55, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(212, 175, 55, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
