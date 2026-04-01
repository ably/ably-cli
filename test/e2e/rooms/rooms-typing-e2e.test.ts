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

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Typing E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let testRoom: string;
  let subscriberId: string;
  let typerId: string;

  beforeEach(() => {
    resetTestTracking();
    testRoom = getUniqueChannelName("room-typing");
    subscriberId = getUniqueClientId("type-sub");
    typerId = getUniqueClientId("typer");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms typing keystroke and subscribe", () => {
    it(
      "should send a keystroke and receive it via subscribe",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should send a keystroke and receive it via subscribe",
        );

        let subscriber: CliRunner | null = null;

        try {
          // Start subscribing to typing events
          subscriber = await startSubscribeCommand(
            [
              "rooms",
              "typing",
              "subscribe",
              testRoom,
              "--client-id",
              subscriberId,
              "--duration",
              "30",
            ],
            /Listening for typing/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Send a keystroke
          const keystrokeResult = await runCommand(
            ["rooms", "typing", "keystroke", testRoom, "--client-id", typerId],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 15000,
            },
          );

          expect(keystrokeResult.exitCode).toBe(0);

          // Wait for the typing event to appear in subscriber output
          await waitForOutput(subscriber, typerId, 15000);
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );
  });
});
