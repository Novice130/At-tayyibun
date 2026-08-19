import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FBF8E8',
          100: '#F7F0D1',
          200: '#EFE1A3',
          300: '#E7D275',
          400: '#DFC347',
          500: '#D4AF37',
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
          500: '#4A0E4E',
          600: '#3E0C41',
          700: '#320A35',
          800: '#260728',
          900: '#1A051C',
        },
        cream: {
          50: '#FDFCFA',
          100: '#FAF8F5',
          200: '#F5F2ED',
          300: '#E8E4DD',
          400: '#D4CCBF',
          500: '#B8AFA2',
        },
        primary: '#D4AF37',
        secondary: '#4A0E4E',
        accent: '#8B5CF6',
        background: '#0F0F1A',
        surface: '#1A1A2E',
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
        // shadcn-style semantic tokens (used by components/ui/*). Mapped to
        // the existing gold/cream/dark palette with dark-mode variants so the
        // primitives render in both themes instead of resolving to nothing.
        foreground: 'hsl(var(--fg))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-fg))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-fg))',
        'primary-foreground': 'hsl(var(--primary-fg))',
        'secondary-foreground': 'hsl(var(--secondary-fg))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-fg))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-fg))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
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
        'soft': '0 2px 12px rgba(0, 0, 0, 0.06)',
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
