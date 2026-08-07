import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          "prefer": "type-imports"
        }
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-namespace": "off"
    }
  },
  {
    files: [
      "eslint.config.js",
      "apps/api/tests/**/*.ts",
      "apps/api/vitest.config.ts",
      "apps/web/e2e/**/*.ts",
      "apps/web/playwright.config.ts",
      "scripts/**/*.mjs"
    ],
    languageOptions: {
      parserOptions: {
        projectService: false
      }
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules
    }
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/web/tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2023
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true
        }
      ]
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/vitest.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
);
