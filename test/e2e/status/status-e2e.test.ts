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

describe("Status E2E Tests", () => {
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

  describe("status", () => {
    it("should check Ably service status", async () => {
      setupTestFailureHandler("should check Ably service status");

      const result = await runCommand(["status"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 15000,
      });

      expect(result.exitCode).toBe(0);
      // Status output should contain some indication of service health
      const combined = result.stdout + result.stderr;
      expect(combined).toMatch(/status|operational|ok|healthy|incident/i);
    });

    it("should output status as JSON", async () => {
      setupTestFailureHandler("should output status as JSON");

      const result = await runCommand(["status", "--json"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 15000,
      });

      expect(result.exitCode).toBe(0);
      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((l) => l.trim().startsWith("{"));
      expect(lines.length).toBeGreaterThan(0);
      const json = JSON.parse(lines[0]);
      expect(json).toHaveProperty("type");
    });
  });
});
