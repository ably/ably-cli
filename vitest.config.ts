import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Needed for oclif testing
    disableConsoleIntercept: true,

    setupFiles: ["./test/setup.ts"],

    // Coverage configuration (shared across projects)
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
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75,
      },
    },

    // Define separate projects for unit and integration tests
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          setupFiles: ["./test/setup.ts", "./test/unit/setup.ts"],
          env: {
            ABLY_CLI_DEFAULT_DURATION: "0.25",
            ABLY_CLI_TEST_MODE: "true",
            ABLY_API_KEY: undefined,
          },
          // This is a temporary workaround whilst a bug / race with test config setup is fixed
          // fixed as it causes races
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
          env: {
            ABLY_CLI_DEFAULT_DURATION: "0.25",
            ABLY_CLI_TEST_MODE: "true",
            ABLY_API_KEY: undefined,
          },
          testTimeout: 20000, // Allow 20s per test for plenty of time on actions
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.test.ts"],
          // Exclude web-cli tests (use Playwright separately)
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "test/e2e/web-cli/**/*.test.ts",
          ],
          env: {
            ABLY_API_KEY: undefined,
          },
          testTimeout: 20000, // Allow 20s per test for plenty of time on actions
          hookTimeout: 60000, // 60 seconds for hooks
          // Run e2e tests sequentially to avoid API rate limits
          sequence: { shuffle: false },
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "hooks",
          include: ["test/hooks/**/*.test.ts"],
          // Exclude web-cli tests (use Playwright separately)
          exclude: ["**/node_modules/**", "**/dist/**"],
          env: {
            ABLY_API_KEY: undefined,
          },
        },
      },
    ],
  },
});
