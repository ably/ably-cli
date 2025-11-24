import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // Require for oclif
    disableConsoleIntercept: true,

    // Setup file
    setupFiles: ["./test/setup.ts"],

    // Global test timeout (can be overridden per test)
    testTimeout: 60000, // 60 seconds for unit tests

    // Hook timeouts
    hookTimeout: 30000,

    // Include patterns - UNIT TESTS ONLY for initial migration
    include: ["test/unit/**/*.test.ts"],

    // Exclude patterns
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "test/integration/**/*.test.ts", // Keep with mocha for now
      "test/e2e/**/*.test.ts", // Keep with mocha for now
      "test/hooks/**/*.test.ts", // Keep with mocha for now
    ],

    // Reporters
    reporters: ["default"],

    // Coverage configuration (replaces nyc)
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
      // Coverage thresholds (from package.json nyc config)
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75,
      },
    },

    // Allow only: false prevents committing .only tests (like mocha's --forbid-only)
    allowOnly: process.env.CI !== "true",

    // Enable global test APIs (describe, it, expect, etc.) without imports
    globals: false, // Require explicit imports for better tree-shaking and clarity

    // Sequence control
    sequence: {
      shuffle: false, // Run tests in deterministic order
    },

    // Retry failed tests
    retry: 0, // No retries by default

    // Max concurrency
    maxConcurrency: 5,

    // Isolate tests
    isolate: true,

    // Pool options
    pool: "forks", // Use forks for better isolation (can change to 'threads' if needed)

    // Type checking (optional, can slow down tests)
    typecheck: {
      enabled: false,
    },
  },

  resolve: {
    alias: {
      // Add any path aliases if needed
    },
  },
});
