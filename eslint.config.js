// @ts-check
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      "android/**",
      "ios/**",
      "dist/**",
      "dist-*/**",
      ".tools/**",
      ".expo/**",
      "coverage/**",
      "node_modules/**",
      "assets/**",
      "scripts/**"
    ]
  },
  {
    rules: {
      // RN sheets/Animated/PanResponder patterns trip React Compiler lint rules today.
      // Keep classic hooks checks; revisit when those call sites are refactored.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off"
    }
  }
]);
