import js from "@eslint/js";
import globalsModule from "globals";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // ─── JS (CJS & ESM) 
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globalsModule.browser,
        ...globalsModule.node,
       
        io: "readonly"
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "unambiguous"  // handles both CJS & ESM
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },

  // ─── Jest Tests 
  {
    files: [
      "**/*.test.js",
      "**/*.spec.js",
      "tests/**/*.{js,cjs}"
    ],
    languageOptions: {
      globals: {
        ...globalsModule.jest
      }
    }
  },

  // ─── Markdown 
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    extends: ["markdown/recommended"]
  },

  // ─── CSS
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"]
  }

]);

