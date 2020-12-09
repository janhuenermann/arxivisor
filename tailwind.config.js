module.exports = {
  purge: [
    './components/**/*.jsx',
    './pages/**/*.jsx'
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
    minWidth: {
        '0': '0',
        '200': '6rem',
        'full': '100%'
    },
    maxWidth: {
      '12rem': '12rem'
    }
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
