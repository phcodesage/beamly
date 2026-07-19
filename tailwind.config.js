/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/templates/**/*.html",
    "./app/static/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        neoYellow: '#FFE600',
        neoBlue: '#00F0FF',
        neoPink: '#FF007A',
        neoGreen: '#00FF66',
        neoBlack: '#000000',
        neoWhite: '#FFFFFF',
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px #000000',
        'neo-lg': '8px 8px 0px 0px #000000',
        'neo-sm': '2px 2px 0px 0px #000000',
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
}
