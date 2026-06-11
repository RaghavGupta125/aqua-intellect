/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // Industrial palette - slate based
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          border: '#e2e8f0',
        },
        ink: {
          DEFAULT: '#0f172a',
          secondary: '#334155',
          muted: '#64748b',
          placeholder: '#94a3b8',
        },
        accent: {
          DEFAULT: '#0ea5e9',
          dark: '#0284c7',
          light: '#e0f2fe',
        },
        status: {
          online: '#16a34a',
          offline: '#94a3b8',
          maintenance: '#d97706',
          fault: '#dc2626',
        },
        alarm: {
          critical: '#dc2626',
          warning: '#d97706',
          info: '#0ea5e9',
          'critical-bg': '#fef2f2',
          'warning-bg': '#fffbeb',
          'info-bg': '#f0f9ff',
        },
      },
    },
  },
  plugins: [],
}
