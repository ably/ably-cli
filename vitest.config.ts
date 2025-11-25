import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Shared configuration for all projects
    environment: "node",
    disableConsoleIntercept: true,
    setupFiles: ["./test/setup.ts"],
    hookTimeout: 30000,
    allowOnly: process.env.CI !== "true",
    globals: false,
    sequence: { shuffle: false },
    retry: 0,
    isolate: true,
    pool: "forks",
    typecheck: { enabled: false },
    reporters: ["default"],

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
          testTimeout: 60000, // 60 seconds for unit tests
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          // Exclude tests that use @oclif/test (mocha-specific)
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 120000, // 120 seconds for integration tests
          env: {
            ABLY_CLI_DEFAULT_DURATION: "0.25",
          },
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
          testTimeout: 300000, // 5 minutes default for e2e tests
          hookTimeout: 60000, // 60 seconds for hooks
          // Run e2e tests sequentially to avoid API rate limits
          sequence: { shuffle: false },
          pool: "forks",
          poolOptions: {
            forks: {
              singleFork: true, // Run all tests in a single fork sequentially
            },
          },
        },
      },
      {
        extends: true,
        test: {
          name: "hooks",
          include: ["test/hooks/**/*.test.ts"],
          // Exclude web-cli tests (use Playwright separately)
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "test/e2e/web-cli/**/*.test.ts",
          ],
          testTimeout: 300000, // 5 minutes default for e2e tests
          hookTimeout: 60000, // 60 seconds for hooks
          // Run e2e tests sequentially to avoid API rate limits
          sequence: { shuffle: false },
          pool: "forks",
          poolOptions: {
            forks: {
              singleFork: true, // Run all tests in a single fork sequentially
            },
          },
        },
      },
    ],
  },

  resolve: {
    alias: {},
  },
});
