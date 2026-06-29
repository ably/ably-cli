import globals from "globals";
// import tseslint from 'typescript-eslint'; // No longer need the combined import
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import eslintPluginN from "eslint-plugin-n";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslint from "@eslint/js"; // Import base eslint config
import vitest from '@vitest/eslint-plugin'
import eslintPluginReact from "eslint-plugin-react"
import eslintPluginReactHooks from "eslint-plugin-react-hooks"
import { fixupPluginRules } from "@eslint/compat"

export default [
  {
    // Globally ignores files
    ignores: [
      "**/dist/**",
      "**/lib/**",
      "**/node_modules/**",
      "**/coverage/**",
      "*.config.js",
      "examples/**", // Ignore all files in examples directory
      "docs/workplans/resources/**", // Ignore resource TSX used for documentation
      "oclif.manifest.json",
      "**/tmp/**",
      "**/.nyc_output/**",
      "**/tsconfig.tsbuildinfo",
      "**/*.d.ts",
      "scripts/postinstall-welcome.ts",
      "node_modules/xterm/**",
      "packages/react-web-cli/dist/index.js",
      "packages/react-web-cli/dist/index.mjs",
      "bin/", // Added from .eslintrc.cjs
      "playwright-report/**", // Ignore Playwright report files
      "**/vitest.config.ts",
      ".claude/worktrees/**",
      ".claude/skills/**"
    ], // Updated to match all ignorePatterns from .eslintrc.json
  },
  {
    // Base configuration for all JS/TS files
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node, // Use Node.js globals
        // Add NodeJS global for scripts that might need it (though prefer importing types)
        NodeJS: "readonly",
      },
    },
    plugins: {
      n: eslintPluginN,
      unicorn: eslintPluginUnicorn,
      prettier: eslintPluginPrettier,
    },
    rules: {
      // Base ESLint recommended rules
      ...eslint.configs.recommended.rules,
      // Node plugin recommended rules
      ...eslintPluginN.configs["flat/recommended-module"].rules,
      // Unicorn plugin recommended rules
      ...eslintPluginUnicorn.configs.recommended.rules,
      // Explicitly configure to work around eslint-plugin-unicorn v68 bug where defaultOptions: [null]
      // fails ESLint 10.3.0's stricter schema validation (null is not "always" or "never")
      "unicorn/logical-assignment-operators": ["error", "always"],
      // Disable noisy stylistic rules for now
      "unicorn/no-null": "off",
      "unicorn/no-array-for-each": "off", // old name (pre-v66), kept for clarity
      "unicorn/no-for-each": "off", // renamed from no-array-for-each in unicorn v66
      "unicorn/no-for-loop": "off",
      "unicorn/prefer-string-raw": "off",
      "unicorn/no-object-as-default-parameter": "off",
      "unicorn/import-style": "off",
      "unicorn/prefer-ternary": "off",
      // Rules from .eslintrc.json
      "unicorn/no-process-exit": "off",
      // New rules added in unicorn v65 (not enforced yet):
      "unicorn/prefer-split-limit": "off",
      "unicorn/prefer-includes-over-repeated-comparisons": "off",
      "unicorn/prefer-string-repeat": "off",
      "unicorn/no-this-outside-of-class": "off",
      "unicorn/no-unnecessary-nested-ternary": "off",
      "unicorn/prefer-iterator-to-array": "off", // v65/v66; requires Iterator Helpers (Node 22+)
      // New rules added in unicorn v66 (not enforced yet):
      "unicorn/no-unnecessary-global-this": "off",
      "unicorn/no-top-level-side-effects": "off",
      "unicorn/consistent-class-member-order": "off",
      "unicorn/prefer-early-return": "off",
      "unicorn/prefer-await": "off",
      "unicorn/prefer-unicode-code-point-escapes": "off",
      "unicorn/no-global-object-property-assignment": "off",
      "unicorn/no-useless-template-literals": "off",
      "unicorn/no-computed-property-existence-check": "off",
      "unicorn/max-nested-calls": "off",
      "unicorn/no-useless-else": "off",
      "unicorn/no-break-in-nested-loop": "off",
      "unicorn/require-array-sort-compare": "off",
      "unicorn/prefer-number-coercion": "off",
      "unicorn/prefer-smaller-scope": "off",
      "unicorn/no-declarations-before-early-exit": "off",
      "unicorn/prefer-minimal-ternary": "off",
      "unicorn/prefer-uint8array-base64": "off",
      "unicorn/prefer-object-define-properties": "off",
      "unicorn/prefer-number-is-safe-integer": "off",
      "unicorn/prefer-direct-iteration": "off",
      "unicorn/no-unsafe-string-replacement": "off",
      "unicorn/no-return-array-push": "off",
      "unicorn/no-negated-array-predicate": "off",
      "unicorn/class-reference-in-static-methods": "off",
      "unicorn/prefer-url-href": "off",
      // New rules added in unicorn v67 (not enforced yet):
      "unicorn/consistent-boolean-name": "off",
      "unicorn/no-top-level-assignment-in-function": "off",
      "unicorn/no-non-function-verb-prefix": "off",
      "unicorn/no-unreadable-for-of-expression": "off",
      "unicorn/no-useless-coercion": "off",
      "unicorn/prefer-else-if": "off",
      "unicorn/operator-assignment": "off",
      // New rules added in unicorn v68 (not enforced yet):
      "unicorn/name-replacements": "off", // renamed from prevent-abbreviations in v68
      "unicorn/consistent-conditional-object-spread": "off",
      "unicorn/no-nonstandard-builtin-properties": "off",
      "unicorn/no-useless-logical-operand": "off",
      "unicorn/no-duplicate-if-branches": "off",
      "unicorn/prefer-promise-with-resolvers": "off",
      "unicorn/prefer-hoisting-branch-code": "off",
      "unicorn/prefer-array-from-async": "off",
      "unicorn/prefer-continue": "off",
      "unicorn/prefer-boolean-return": "off",
      "unicorn/no-unnecessary-boolean-comparison": "off",
      "unicorn/default-export-style": "off",
      "n/no-process-exit": "off",
      "n/no-unsupported-features/node-builtins": "off",
      // Prettier
      "prettier/prettier": "error",
    },
  },
  {
    // Configuration specific to TypeScript files
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tsPlugin, // Use the imported plugin object
    },
    languageOptions: {
      parser: tsParser, // Use the imported parser object
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      // Use type-checked rules — requires parserOptions.project above
      ...tsPlugin.configs["recommended-type-checked"].rules,
      // Your custom rules from .eslintrc.json
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // no-unsafe-* and no-base-to-string: enabled in src/, disabled in test/ (mock typing)
      // Cherry-picked from strict-type-checked
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-useless-constructor": "error",
      "@typescript-eslint/unified-signatures": "error",
      "@typescript-eslint/return-await": "error",
      // Add other TS specific rules or overrides here
      "unicorn/prefer-module": "off",
      "unicorn/prevent-abbreviations": "off", // old name (pre-v68), kept for clarity
      "unicorn/name-replacements": "off", // renamed from prevent-abbreviations in unicorn v68
      "unicorn/numeric-separators-style": "off",
    },
  },
  {
    // Configuration for React Web CLI package - TSX files
    files: ["packages/react-web-cli/**/*.{ts,tsx}"],
    plugins: {
      react: fixupPluginRules(eslintPluginReact),
      "react-hooks": fixupPluginRules(eslintPluginReactHooks),
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React recommended rules
      ...eslintPluginReact.configs.recommended.rules,
      ...eslintPluginReact.configs["jsx-runtime"].rules,
      // TypeScript rules (type-checked for full safety)
      ...tsPlugin.configs["recommended-type-checked"].rules,
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // Custom overrides for this package
      "unicorn/prefer-module": "off",
      "unicorn/filename-case": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-array-reduce": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-useless-constructor": "error",
      "@typescript-eslint/unified-signatures": "error",
      "@typescript-eslint/return-await": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-control-regex": "off", // Terminal escape sequences use control chars
      "n/no-missing-import": "off", // TSX imports are handled by TypeScript
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
    },
  },
  {
    // Configuration specific to test files
    files: ["test/**/*.test.ts"],
    plugins: {
      vitest: vitest,
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      // Apply recommended vitest rules
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-expressions": "off",
      // Tests legitimately use `any` for mocking — disable no-unsafe-* family
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      "vitest/no-focused-tests": "error", // Equivalent to mocha/no-exclusive-tests
      "vitest/no-disabled-tests": "warn", // Equivalent to mocha/no-skipped-tests
    },
  },
  {
    // Configuration specific to test files
    files: ["packages/react-web-cli/**/*.test.ts", "packages/react-web-cli/**/*.test.tsx"],
    plugins: {
      vitest: vitest,
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
        ...globals.browser,
      },
    },
    rules: {
      // Apply recommended vitest rules
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      // Tests legitimately use `any` for mocking
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "no-console": "off",
      "vitest/no-focused-tests": "error", // Equivalent to mocha/no-exclusive-tests
      "vitest/no-disabled-tests": "warn", // Equivalent to mocha/no-skipped-tests
    },
  },
  {
    // Configuration specific to server test files
    files: ["server/tests/**/*.test.ts"],
    plugins: {
      vitest: vitest,
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      // Apply recommended vitest rules
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-expressions": "off",
      "vitest/no-focused-tests": "error", // Equivalent to mocha/no-exclusive-tests
      "vitest/no-disabled-tests": "warn", // Equivalent to mocha/no-skipped-tests
      "unicorn/prefer-optional-catch-binding": "off", // Allow catch (error) in tests
      "n/no-unpublished-import": "off", // Allow dev dependencies like chai in tests
    },
  },
  // Prettier config must be last
  eslintConfigPrettier,
  {
    // All test and test-helper files: disable no-unsafe-* rules (tests legitimately use `any` for mocking)
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    // oclif hook directories use underscores in their names (e.g. command_not_found) — exempt from filename-case
    files: ["src/hooks/**/*.ts", "test/hooks/**/*.ts"],
    rules: {
      "unicorn/filename-case": "off",
    },
  },
  {
    // Playwright browser E2E tests – allow browser globals and silence node-specific rules
    files: ["test/e2e/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "unicorn/prefer-global-this": "off",
      "no-undef": "off",
      "unicorn/prefer-optional-catch-binding": "off",
      "unicorn/catch-error-name": "off",
      "n/no-missing-import": "off",
    },
  },
];
