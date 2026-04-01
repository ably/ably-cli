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

describe("Support E2E Tests", () => {
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

  describe("support contact", () => {
    it("should show support contact help", async () => {
      setupTestFailureHandler("should show support contact help");

      const result = await runCommand(["support", "contact", "--help"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/contact|support|ably/i);
    });
  });
});
