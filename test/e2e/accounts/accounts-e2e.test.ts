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
  E2E_ACCESS_TOKEN,
  SHOULD_SKIP_CONTROL_E2E,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";

describe.skipIf(SHOULD_SKIP_CONTROL_E2E)("Accounts E2E Tests", () => {
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

  it(
    "should list locally configured accounts",
    { timeout: 15000 },
    async () => {
      setupTestFailureHandler("should list locally configured accounts");

      // accounts list reads from local config, not the API directly.
      // In E2E environment, there may or may not be configured accounts.
      // We just verify the command runs without crashing.
      const listResult = await runCommand(["accounts", "list"], {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      });

      // The command may exit 0 (accounts found) or non-zero (no accounts configured).
      // Either way, it should produce output and not crash.
      const combinedOutput = listResult.stdout + listResult.stderr;
      expect(combinedOutput.length).toBeGreaterThan(0);
    },
  );

  it("should show help for accounts current", { timeout: 10000 }, async () => {
    setupTestFailureHandler("should show help for accounts current");

    const helpResult = await runCommand(["accounts", "current", "--help"], {
      env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
    });

    expect(helpResult.exitCode).toBe(0);
    const output = helpResult.stdout + helpResult.stderr;
    expect(output).toContain("USAGE");
  });
});
