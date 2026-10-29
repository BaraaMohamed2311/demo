import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,   // Enables Node.js globals (require, module, process, setTimeout, etc.)
        ...globals.jest    // Enables Jest test globals (describe, test, expect, etc.)
      }
    },
    rules: {
      // Add your custom rules here
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];