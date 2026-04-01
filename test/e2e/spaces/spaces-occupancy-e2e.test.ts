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
  getUniqueChannelName,
  getUniqueClientId,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  runCommand,
  startPresenceCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";

describe.skipIf(SHOULD_SKIP_E2E)("Spaces Occupancy E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let spaceName: string;
  let clientId: string;

  beforeEach(() => {
    resetTestTracking();
    spaceName = getUniqueChannelName("space-occ");
    clientId = getUniqueClientId("occ-client");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("spaces occupancy get", () => {
    it("should get space occupancy", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should get space occupancy");

      let memberRunner: CliRunner | null = null;

      try {
        // Enter a member into the space to ensure non-zero occupancy
        memberRunner = await startPresenceCommand(
          [
            "spaces",
            "members",
            "enter",
            spaceName,
            "--client-id",
            clientId,
            "--duration",
            "15",
          ],
          /Entered|Holding|member/i,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Wait for member to propagate
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get occupancy
        const result = await runCommand(
          ["spaces", "occupancy", "get", spaceName, "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 15000,
          },
        );

        expect(result.exitCode).toBe(0);
      } finally {
        if (memberRunner) {
          await cleanupRunners([memberRunner]);
        }
      }
    });
  });
});
