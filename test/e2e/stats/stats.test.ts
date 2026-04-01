import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { spawn } from "node:child_process";
import { join } from "node:path";

const E2E_ACCESS_TOKEN = process.env.E2E_ABLY_ACCESS_TOKEN;

// Stats tests require an access token for account-level stats
const SKIP_ACCOUNT_STATS = !E2E_ACCESS_TOKEN;

// Helper function to parse JSON lines from command output
function parseJsonLines(stdout: string): Record<string, unknown>[] {
  const lines = stdout.trim().split("\n");
  const jsonLines = lines.filter((line) => line.trim().startsWith("{"));
  return jsonLines.map(
    (line) => JSON.parse(line.trim()) as Record<string, unknown>,
  );
}

describe.skipIf(SHOULD_SKIP_E2E || SKIP_ACCOUNT_STATS)(
  "Stats E2E Tests",
  () => {
    beforeAll(() => {
      process.on("SIGINT", forceExit);
    });

    afterAll(() => {
      process.removeListener("SIGINT", forceExit);
    });

    beforeEach(() => {
      resetTestTracking();
    });

    afterEach(async () => {
      await cleanupTrackedResources();
    });

    describe("stats account", () => {
      it(
        "should fetch account stats with default settings",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should fetch account stats with default settings",
          );

          const result = await runCommand(["stats", "account"], {
            timeoutMs: 60000,
            env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
          });

          expect(result.exitCode).toBe(0);
          // Output should contain some stats information or "No stats found"
          expect(
            result.stdout.includes("Stats") ||
              result.stdout.includes("Messages") ||
              result.stdout.includes("Connections") ||
              result.stdout.includes("No stats found"),
          ).toBe(true);
        },
      );

      it(
        "should fetch account stats with hour unit",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should fetch account stats with hour unit");

          const result = await runCommand(
            ["stats", "account", "--unit", "hour"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should fetch account stats with day unit",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should fetch account stats with day unit");

          const result = await runCommand(
            ["stats", "account", "--unit", "day"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should fetch account stats with limit",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should fetch account stats with limit");

          const result = await runCommand(
            ["stats", "account", "--limit", "5"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should output account stats in JSON format",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should output account stats in JSON format");

          const result = await runCommand(
            ["stats", "account", "--json", "--limit", "1"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).toBe(0);

          const hasNoStats = result.stdout.includes("No stats found");
          if (hasNoStats) {
            return;
          }

          // Must have at least one valid JSON line
          const lines = result.stdout.trim().split("\n");
          const jsonLines = lines.filter((line) => line.trim().startsWith("{"));
          expect(jsonLines.length).toBeGreaterThan(0);

          for (const line of jsonLines) {
            expect(() => JSON.parse(line.trim())).not.toThrow();
          }
        },
      );

      it(
        "should output account stats in pretty JSON format",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should output account stats in pretty JSON format",
          );

          const result = await runCommand(
            ["stats", "account", "--pretty-json", "--limit", "1"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should handle live stats subscription briefly",
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler(
            "should handle live stats subscription briefly",
          );

          const cliPath = join(process.cwd(), "bin", "run.js");

          // Start live stats subscription
          const statsMonitor = spawn(
            "node",
            [cliPath, "stats", "account", "--live", "--interval", "2"],
            {
              env: {
                ...process.env,
                ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN!,
              },
            },
          );

          let output = "";
          statsMonitor.stdout.on("data", (data) => {
            output += data.toString();
          });
          statsMonitor.stderr.on("data", (data) => {
            output += data.toString();
          });

          // Wait for some output
          await new Promise((resolve) => setTimeout(resolve, 8000));

          // Gracefully terminate
          statsMonitor.kill("SIGTERM");

          await new Promise<void>((resolve) => {
            statsMonitor.on("exit", () => resolve());
            setTimeout(resolve, 5000); // Fallback timeout
          });

          // Verify it started subscription
          expect(output).toContain("Subscribing to live stats");
        },
      );
    });

    describe("stats app", () => {
      it(
        "should fetch app stats with default settings using access token",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should fetch app stats with default settings using access token",
          );

          const result = await runCommand(["stats", "app"], {
            timeoutMs: 60000,
            env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
          });

          // Either success or an error about no app ID selected (which is expected without config)
          expect(
            result.exitCode === 0 ||
              result.stderr.includes("No app ID provided"),
          ).toBe(true);
        },
      );

      it(
        "should fetch app stats using access token",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should fetch app stats using access token");

          // Verify API key is available (for extracting app ID)
          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          // Extract app ID from API key
          const appId = E2E_API_KEY.split(".")[0];

          const result = await runCommand(["stats", "app", appId], {
            timeoutMs: 60000,
            env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
          });

          expect(result.exitCode).toBe(0);
          expect(
            result.stdout.includes("Fetching stats for app") ||
              result.stdout.includes("Stats") ||
              result.stdout.includes("Messages") ||
              result.stdout.includes("Connections") ||
              result.stdout.includes("No stats found"),
          ).toBe(true);
        },
      );

      it(
        "should fetch app stats with hour unit",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should fetch app stats with hour unit");

          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          const appId = E2E_API_KEY.split(".")[0];

          const result = await runCommand(
            ["stats", "app", appId, "--unit", "hour"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should fetch app stats with day unit",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should fetch app stats with day unit");

          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          const appId = E2E_API_KEY.split(".")[0];

          const result = await runCommand(
            ["stats", "app", appId, "--unit", "day"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it("should fetch app stats with limit", { timeout: 60000 }, async () => {
        setupTestFailureHandler("should fetch app stats with limit");

        if (!E2E_API_KEY) {
          throw new Error("E2E_API_KEY is not available for testing");
        }

        const appId = E2E_API_KEY.split(".")[0];

        const result = await runCommand(
          ["stats", "app", appId, "--limit", "5"],
          {
            timeoutMs: 60000,
            env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
          },
        );

        expect(result.exitCode).toBe(0);
      });

      it(
        "should output app stats in JSON format",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should output app stats in JSON format");

          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          const appId = E2E_API_KEY.split(".")[0];

          const result = await runCommand(
            ["stats", "app", appId, "--json", "--limit", "1"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
            },
          );

          expect(result.exitCode).toBe(0);

          const hasNoStats = result.stdout.includes("No stats found");
          if (hasNoStats) {
            return;
          }

          // Must have at least one valid JSON line
          const lines = result.stdout.trim().split("\n");
          const jsonLines = lines.filter((line) => line.trim().startsWith("{"));
          expect(jsonLines.length).toBeGreaterThan(0);

          for (const line of jsonLines) {
            expect(() => JSON.parse(line.trim())).not.toThrow();
          }
        },
      );

      it(
        "should output app stats in pretty JSON format",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should output app stats in pretty JSON format",
          );

          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          const appId = E2E_API_KEY.split(".")[0];

          const result = await runCommand(
            ["stats", "app", appId, "--pretty-json", "--limit", "1"],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should handle live app stats subscription briefly",
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler(
            "should handle live app stats subscription briefly",
          );

          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          const cliPath = join(process.cwd(), "bin", "run.js");
          const appId = E2E_API_KEY.split(".")[0];

          // Start live stats subscription
          const statsMonitor = spawn(
            "node",
            [cliPath, "stats", "app", appId, "--live", "--interval", "2"],
            {
              env: {
                ...process.env,
                ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN,
              },
            },
          );

          let output = "";
          statsMonitor.stdout.on("data", (data) => {
            output += data.toString();
          });
          statsMonitor.stderr.on("data", (data) => {
            output += data.toString();
          });

          // Wait for some output
          await new Promise((resolve) => setTimeout(resolve, 8000));

          // Gracefully terminate
          statsMonitor.kill("SIGTERM");

          await new Promise<void>((resolve) => {
            statsMonitor.on("exit", () => resolve());
            setTimeout(resolve, 5000); // Fallback timeout
          });

          // Verify it started subscription
          expect(output).toContain("Subscribing to live stats");
        },
      );
    });

    describe("Error Handling", () => {
      it(
        "should handle invalid unit option gracefully",
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler(
            "should handle invalid unit option gracefully",
          );

          const result = await runCommand(
            ["stats", "account", "--unit", "invalid"],
            {
              timeoutMs: 30000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).not.toBe(0);
          expect(result.stderr).toContain("Expected --unit=");
        },
      );

      it(
        "should handle invalid timestamp formats gracefully",
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler(
            "should handle invalid timestamp formats gracefully",
          );

          const result = await runCommand(
            ["stats", "account", "--start", "not-a-timestamp"],
            {
              timeoutMs: 30000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).not.toBe(0);
        },
      );

      it(
        "should handle non-existent app ID gracefully",
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler(
            "should handle non-existent app ID gracefully",
          );

          const result = await runCommand(
            ["stats", "app", "non-existent-app-id"],
            {
              timeoutMs: 30000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
            },
          );

          // Should fail with an error about app not found or unauthorized
          expect(result.exitCode).not.toBe(0);
        },
      );

      it(
        "should reject invalid authentication",
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler("should reject invalid authentication");

          const result = await runCommand(["stats", "account"], {
            timeoutMs: 30000,
            env: { ABLY_ACCESS_TOKEN: "invalid-token" },
          });

          expect(result.exitCode).not.toBe(0);
          // Should contain an authentication error
          expect(
            result.stderr.includes("401") ||
              result.stderr.includes("authentication") ||
              result.stderr.includes("unauthorized") ||
              result.stderr.includes("Unauthorized") ||
              result.stderr.includes("Error"),
          ).toBe(true);
        },
      );
    });

    describe("Time Range Filtering", () => {
      it(
        "should fetch account stats with custom time range",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should fetch account stats with custom time range",
          );

          const now = Date.now();
          const oneHourAgo = now - 60 * 60 * 1000;

          const result = await runCommand(
            [
              "stats",
              "account",
              "--start",
              oneHourAgo.toString(),
              "--end",
              now.toString(),
            ],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should fetch app stats with custom time range",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should fetch app stats with custom time range",
          );

          if (!E2E_API_KEY) {
            throw new Error("E2E_API_KEY is not available for testing");
          }

          const appId = E2E_API_KEY.split(".")[0];
          const now = Date.now();
          const oneHourAgo = now - 60 * 60 * 1000;

          const result = await runCommand(
            [
              "stats",
              "app",
              appId,
              "--start",
              oneHourAgo.toString(),
              "--end",
              now.toString(),
            ],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN },
            },
          );

          expect(result.exitCode).toBe(0);
        },
      );

      it(
        "should handle empty stats gracefully for narrow time range",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler(
            "should handle empty stats gracefully for narrow time range",
          );

          // Use a very recent time range that's unlikely to have stats
          const endTime = Date.now();
          const startTime = endTime - 1000; // 1 second ago

          const result = await runCommand(
            [
              "stats",
              "account",
              "--start",
              startTime.toString(),
              "--end",
              endTime.toString(),
            ],
            {
              timeoutMs: 60000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          // Should exit successfully even with no stats
          expect(result.exitCode).toBe(0);
        },
      );
    });

    describe("Performance and Reliability", () => {
      it(
        "should complete stats retrieval within reasonable time",
        { timeout: 45000 },
        async () => {
          setupTestFailureHandler(
            "should complete stats retrieval within reasonable time",
          );

          const startTime = Date.now();
          const result = await runCommand(
            ["stats", "account", "--limit", "10"],
            {
              timeoutMs: 45000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );
          const endTime = Date.now();

          expect(result.exitCode).toBe(0);
          expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
        },
      );

      it(
        "should handle multiple consecutive stats requests",
        { timeout: 120000 },
        async () => {
          setupTestFailureHandler(
            "should handle multiple consecutive stats requests",
          );

          // Run multiple stats requests in sequence
          for (let i = 0; i < 3; i++) {
            const result = await runCommand(
              ["stats", "account", "--limit", "2"],
              {
                timeoutMs: 30000,
                env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
              },
            );
            expect(result.exitCode).toBe(0);
          }
        },
      );

      it(
        "should maintain consistent output format across requests",
        { timeout: 90000 },
        async () => {
          setupTestFailureHandler(
            "should maintain consistent output format across requests",
          );

          // Run the same command twice and verify consistent output structure
          const result1 = await runCommand(
            ["stats", "account", "--json", "--limit", "2"],
            {
              timeoutMs: 45000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );
          const result2 = await runCommand(
            ["stats", "account", "--json", "--limit", "2"],
            {
              timeoutMs: 45000,
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN! },
            },
          );

          expect(result1.exitCode).toBe(0);
          expect(result2.exitCode).toBe(0);

          // Parse JSON lines from both outputs
          const json1 = parseJsonLines(result1.stdout);
          const json2 = parseJsonLines(result2.stdout);

          // Both should have the same number of JSON objects (or both empty)
          // Verify that both have consistent structure (either both empty or both have same keys)
          const keys1 =
            json1.length > 0 ? Object.keys(json1[0]).toSorted() : [];
          const keys2 =
            json2.length > 0 ? Object.keys(json2[0]).toSorted() : [];
          expect(keys1).toEqual(keys2);
        },
      );
    });
  },
);
