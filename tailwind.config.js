/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        discord: {
          darkest: '#1e1f22',
          sidebar: '#2b2d31',
          chat: '#313338',
          hover: '#35373c',
          active: '#404249',
          input: '#383a40',
          divider: '#3f4147',
          blurple: {
            DEFAULT: '#5865f2',
            hover: '#4752c4',
            light: '#7983f5',
          },
          green: {
            DEFAULT: '#23a55a',
            hover: '#1a7e44',
          },
          yellow: '#f0b232',
          red: {
            DEFAULT: '#f23f43',
            hover: '#da373b',
          },
          gray: {
            100: '#f2f3f5',
            200: '#ebedef',
            300: '#dbdee1',
            400: '#949ba4',
            500: '#80848e',
            600: '#4e5058',
            700: '#313338',
            800: '#2b2d31',
            900: '#1e1f22',
          }
        }
      },
      fontFamily: {
        sans: [
          'gg sans',
          'Noto Sans',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        'discord': '4px',
        'discord-lg': '8px',
      }
    },
  },
  plugins: [],
}
