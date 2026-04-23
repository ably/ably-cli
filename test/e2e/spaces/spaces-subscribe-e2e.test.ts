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

describe.skipIf(SHOULD_SKIP_E2E)("Spaces Subscribe E2E Tests", () => {
  const runners: CliRunner[] = [];

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupRunners(runners);
    runners.length = 0;
    await cleanupTrackedResources();
  });

  it("should receive member events when a member enters a space", async () => {
    setupTestFailureHandler(
      "should receive member events when a member enters a space",
    );

    const spaceName = getUniqueChannelName("space-sub");
    const subClientId = getUniqueClientId("space-sub-client");
    const enterClientId = getUniqueClientId("space-enter-client");

    // Start the space subscriber
    const subscriber = await startSubscribeCommand(
      [
        "spaces",
        "subscribe",
        spaceName,
        "--client-id",
        subClientId,
        "--duration",
        "30",
      ],
      /Listening for space|Subscribed to space/i,
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );
    runners.push(subscriber);

    // Wait for subscription to be established
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Enter the space with a different client to trigger a member event
    const enterer = await startPresenceCommand(
      [
        "spaces",
        "members",
        "enter",
        spaceName,
        "--client-id",
        enterClientId,
        "--duration",
        "15",
      ],
      /Entered space|Holding|entering/i,
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );
    runners.push(enterer);

    // Wait for the subscriber to receive the member event
    await waitForOutput(subscriber, enterClientId, 15000);

    // Verify the member event appeared in subscriber output
    expect(subscriber.combined()).toContain(enterClientId);
  }, 60000);
});
