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

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Presence Subscribe E2E Tests", () => {
  const runners: CliRunner[] = [];

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupRunners(runners);
    runners.length = 0;
    await cleanupTrackedResources();
  });

  it("should receive presence enter events when a member enters a room", async () => {
    setupTestFailureHandler(
      "should receive presence enter events when a member enters a room",
    );

    const testRoom = getUniqueChannelName("room-pres-sub");
    const subClientId = getUniqueClientId("pres-sub");
    const enterClientId = getUniqueClientId("pres-enter");

    // Start presence subscriber
    const subscriber = await startSubscribeCommand(
      [
        "rooms",
        "presence",
        "subscribe",
        testRoom,
        "--client-id",
        subClientId,
        "--duration",
        "30",
      ],
      /Listening for presence|Subscribed to presence/i,
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );
    runners.push(subscriber);

    // Wait a moment for subscription to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Enter presence with a different client
    const enterer = await startPresenceCommand(
      [
        "rooms",
        "presence",
        "enter",
        testRoom,
        "--client-id",
        enterClientId,
        "--duration",
        "15",
      ],
      /Entered presence|Holding|entering/i,
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );
    runners.push(enterer);

    // Wait for the subscriber to see the enter event
    await waitForOutput(subscriber, enterClientId, 15000);

    // Verify the enter event appeared in subscriber output
    expect(subscriber.combined()).toContain(enterClientId);
  }, 60000);
});
