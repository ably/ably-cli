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

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Reactions E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let testRoom: string;
  let client1Id: string;
  let client2Id: string;

  beforeEach(() => {
    resetTestTracking();
    testRoom = getUniqueChannelName("room-react");
    client1Id = getUniqueClientId("react-sub");
    client2Id = getUniqueClientId("react-send");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms reactions send and subscribe", () => {
    it(
      "should send a room reaction and receive it via subscribe",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should send a room reaction and receive it via subscribe",
        );

        let subscriber: CliRunner | null = null;

        try {
          // Start subscribing to room reactions
          subscriber = await startSubscribeCommand(
            [
              "rooms",
              "reactions",
              "subscribe",
              testRoom,
              "--client-id",
              client1Id,
              "--duration",
              "30",
            ],
            /Listening for reactions/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Send a reaction
          const sendResult = await runCommand(
            [
              "rooms",
              "reactions",
              "send",
              testRoom,
              "thumbsup",
              "--client-id",
              client2Id,
            ],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 15000,
            },
          );

          expect(sendResult.exitCode).toBe(0);

          // Wait for the reaction to appear in subscriber output
          await waitForOutput(subscriber, "thumbsup", 15000);
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );
  });
});
