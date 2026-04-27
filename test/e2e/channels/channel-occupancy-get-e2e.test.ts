import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  runCommand,
  startSubscribeCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Channel Occupancy Get E2E Tests", () => {
  const runners: CliRunner[] = [];

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupRunners(runners);
    runners.length = 0;
    await cleanupTrackedResources();
  });

  it(
    "should get occupancy data for a channel with an active subscriber",
    { timeout: 60000 },
    async () => {
      setupTestFailureHandler(
        "should get occupancy data for a channel with an active subscriber",
      );

      const channel = getUniqueChannelName("occupancy");

      // Start a subscriber to create some occupancy
      const subscriber = await startSubscribeCommand(
        ["channels", "subscribe", channel, "--duration", "30"],
        /Listening for messages/,
        { env: { ABLY_API_KEY: E2E_API_KEY || "" } },
      );
      runners.push(subscriber);

      // Give some time for the subscriber to be fully registered
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get occupancy via CLI
      const result = await runCommand(
        ["channels", "occupancy", "get", channel, "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      // Parse JSON output
      const records = parseNdjsonLines(result.stdout);
      const resultObj = records.find((r) => r.type === "result" || r.occupancy);

      expect(resultObj).toBeDefined();
      expect(resultObj!.occupancy).toBeDefined();

      const occupancy = resultObj!.occupancy as {
        channel: string;
        metrics: Record<string, number>;
      };
      expect(occupancy.channel).toBe(channel);
      expect(occupancy.metrics).toBeDefined();
      expect(typeof occupancy.metrics.subscribers).toBe("number");
    },
  );
});
