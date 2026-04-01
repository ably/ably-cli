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
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";

describe("Config E2E Tests", () => {
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

  describe("config show", () => {
    it("should run config show without crashing", async () => {
      setupTestFailureHandler("should run config show without crashing");

      const result = await runCommand(["config", "show"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      // Command should either succeed (config exists) or fail gracefully
      // (config missing — exit code 1 in JSON mode, 2 in non-JSON mode).
      expect([0, 1, 2]).toContain(result.exitCode);
    });

    it("should run config show with --json without crashing", async () => {
      setupTestFailureHandler(
        "should run config show with --json without crashing",
      );

      const result = await runCommand(["config", "show", "--json"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      // Same as above — just verify it doesn't crash
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe("config path", () => {
    it("should print the config file path", async () => {
      setupTestFailureHandler("should print the config file path");

      const result = await runCommand(["config", "path"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\.ably/);
    });

    it("should output config path as JSON", async () => {
      setupTestFailureHandler("should output config path as JSON");

      const result = await runCommand(["config", "path", "--json"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((l) => l.trim().startsWith("{"));
      expect(lines.length).toBeGreaterThan(0);
      const json = JSON.parse(lines[0]);
      expect(json).toHaveProperty("config");
      expect(json.config).toHaveProperty("path");
    });
  });
});
