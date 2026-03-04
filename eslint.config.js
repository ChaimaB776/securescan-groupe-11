const security = require("eslint-plugin-security");

module.exports = [
  {
    plugins: { security },
    rules: {
      "security/detect-object-injection": "warn",
      "security/detect-eval-with-expression": "error"
    }
  }
];