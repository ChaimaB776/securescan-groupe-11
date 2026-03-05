const security = require("eslint-plugin-security");

module.exports = [
  {
    plugins: {
      security
    },
    rules: {
      ...security.configs.recommended.rules
    }
  }
];