/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // KCA Brand Colors
        'kca-primary': '#E8752A',
        'kca-primary-hover': '#D5651D',
        'kca-primary-bg': '#FFF7F2',
        'kca-black': '#222222',
        'kca-dark': '#333333',
        'kca-text': '#444444',
        'kca-text-secondary': '#666666',
        'kca-text-muted': '#999999',
        'kca-text-light': '#BBBBBB',
        'kca-bg': '#FFFFFF',
        'kca-bg-page': '#F7F7F7',
        'kca-bg-light': '#FAFAFA',
        'kca-border': '#E0E0E0',
        'kca-border-light': '#EEEEEE',
        'kca-border-dark': '#CCCCCC',
        'kca-success': '#4CAF50',
        'kca-warning': '#FFC107',
        'kca-error': '#F44336',
        'kca-info': '#2196F3',
      },
      fontFamily: {
        'kca': ["'Noto Sans KR'", "'맑은 고딕'", 'sans-serif'],
      },
      spacing: {
        'topbar': '80px',
        'subnav': '50px',
        'sidebar': '240px',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Disable Tailwind's reset to avoid conflicts with Ant Design
  },
}
