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
  startSubscribeCommand,
  waitForOutput,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Messages Subscribe E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let testRoom: string;
  let subscriberId: string;
  let senderId: string;

  beforeEach(() => {
    resetTestTracking();
    testRoom = getUniqueChannelName("room-sub");
    subscriberId = getUniqueClientId("subscriber");
    senderId = getUniqueClientId("sender");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms messages subscribe", () => {
    it(
      "should subscribe to room messages and receive a sent message",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should subscribe to room messages and receive a sent message",
        );

        let subscriber: CliRunner | null = null;

        try {
          // Start subscribing to room messages
          subscriber = await startSubscribeCommand(
            [
              "rooms",
              "messages",
              "subscribe",
              testRoom,
              "--client-id",
              subscriberId,
              "--duration",
              "30",
            ],
            /Listening for messages/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Send a message to the room
          const sendResult = await runCommand(
            [
              "rooms",
              "messages",
              "send",
              testRoom,
              "subscribe-test-msg",
              "--client-id",
              senderId,
            ],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 15000,
            },
          );

          expect(sendResult.exitCode).toBe(0);

          // Wait for the message to appear in subscriber output
          await waitForOutput(subscriber, "subscribe-test-msg", 15000);
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );
  });
});
