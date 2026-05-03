import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-page': '#050505',
        'bg-surface': '#0a0a0a',
        'bg-elev': '#0f0f0f',
        'bg-slot-empty': '#0f0f0f',
        'bg-slot-filled': '#1f2937',
        'border-default': '#262626',
        'border-subtle': '#1a1a1a',
        'border-dashed-empty': '#2a2a2a',
        'border-slot-filled': '#374151',
        accent: {
          DEFAULT: '#5BD3A8',
          deep: '#2a8568',
          deeper: '#1a3d2e',
        },
        danger: {
          DEFAULT: '#b91c1c',
          soft: '#f87171',
        },
        text: {
          default: '#fafafa',
          muted: '#a3a3a3',
          dim: '#737373',
          faint: '#525252',
          ghost: '#404040',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
