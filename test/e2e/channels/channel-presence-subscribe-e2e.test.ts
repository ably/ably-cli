import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  getUniqueClientId,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  startSubscribeCommand,
  startPresenceCommand,
  waitForOutput,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";

describe.skipIf(SHOULD_SKIP_E2E)("Channel Presence Subscribe E2E Tests", () => {
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
    "should receive presence enter events on a subscribed channel",
    { timeout: 60000 },
    async () => {
      setupTestFailureHandler(
        "should receive presence enter events on a subscribed channel",
      );

      const channel = getUniqueChannelName("pres-sub");
      const subClientId = getUniqueClientId("sub-client");
      const enterClientId = getUniqueClientId("enter-client");

      // Start presence subscriber
      const subscriber = await startSubscribeCommand(
        [
          "channels",
          "presence",
          "subscribe",
          channel,
          "--client-id",
          subClientId,
          "--duration",
          "30",
        ],
        /Listening for presence events/,
        { env: { ABLY_API_KEY: E2E_API_KEY || "" } },
      );
      runners.push(subscriber);

      // Start presence enter on the same channel with a different client
      const enterer = await startPresenceCommand(
        [
          "channels",
          "presence",
          "enter",
          channel,
          "--client-id",
          enterClientId,
          "--data",
          '{"status":"online"}',
          "--duration",
          "30",
        ],
        /Entered presence/,
        { env: { ABLY_API_KEY: E2E_API_KEY || "" } },
      );
      runners.push(enterer);

      // Wait for the subscriber to see the enter event
      await waitForOutput(subscriber, enterClientId, 15000);

      const output = subscriber.combined();
      expect(output).toContain(enterClientId);
    },
  );
});
