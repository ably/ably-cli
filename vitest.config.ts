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
      reportOnFailure: true,
      include: ["src/**/*.ts", "dist/src/**/*.js"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "dist/src/**/index.js",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
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
      // TTY tests require a real pseudo-terminal (node-pty) — local only, not CI.
      // Gated behind VITEST_TTY=1 so `pnpm test` doesn't include them.
      // Run explicitly with: pnpm test:tty
      ...(process.env.VITEST_TTY === "1"
        ? [
            {
              extends: true,
              test: {
                name: "tty",
                include: ["test/tty/**/*.test.ts"],
                env: {
                  ABLY_CLI_TEST_MODE: "true",
                  ABLY_API_KEY: undefined,
                  // ABLY_CLI_DEFAULT_DURATION is intentionally omitted for TTY tests.
                  // TTY tests manage their own timing via explicit --duration flags
                  // and real PTY I/O, unlike unit tests that use the 250ms auto-exit.
                },
                testTimeout: 15000,
                // TTY tests are slow (real PTY I/O) — run sequentially
                fileParallelism: false,
                sequence: { shuffle: false },
              },
            },
          ]
        : []),
    ],
  },
});
