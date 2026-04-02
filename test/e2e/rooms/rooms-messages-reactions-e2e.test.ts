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
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Message Reactions E2E Tests", () => {
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
    testRoom = getUniqueChannelName("room-msgreact");
    client1Id = getUniqueClientId("msgreact-sub");
    client2Id = getUniqueClientId("msgreact-send");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms messages reactions", () => {
    it("should send a message reaction", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should send a message reaction");

      // First send a message to get a serial
      const sendResult = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          "reaction-target",
          "--client-id",
          client1Id,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(sendResult.exitCode).toBe(0);

      const sendJsonLines = parseNdjsonLines(sendResult.stdout);
      const resultLine = sendJsonLines.find((l) => l.type === "result");
      expect(resultLine).toBeDefined();

      const message = (resultLine?.message ?? resultLine) as Record<
        string,
        unknown
      >;
      const serial = message.serial as string | undefined;
      expect(serial).toBeDefined();

      // Send a reaction to the message
      const reactionResult = await runCommand(
        [
          "rooms",
          "messages",
          "reactions",
          "send",
          testRoom,
          serial!,
          "like",
          "--client-id",
          client2Id,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 15000,
        },
      );

      expect(reactionResult.exitCode).toBe(0);
    });

    it(
      "should subscribe to message reactions and receive events",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should subscribe to message reactions and receive events",
        );

        let subscriber: CliRunner | null = null;

        try {
          // Start subscribing to message reactions
          subscriber = await startSubscribeCommand(
            [
              "rooms",
              "messages",
              "reactions",
              "subscribe",
              testRoom,
              "--client-id",
              client1Id,
              "--duration",
              "30",
            ],
            /Listening for message reactions/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Send a message first
          const sendResult = await runCommand(
            [
              "rooms",
              "messages",
              "send",
              testRoom,
              "react-subscribe-target",
              "--client-id",
              client1Id,
              "--json",
            ],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 15000,
            },
          );

          expect(sendResult.exitCode).toBe(0);

          const sendJsonLines = parseNdjsonLines(sendResult.stdout);
          const resultLine = sendJsonLines.find((l) => l.type === "result");
          const message = (resultLine?.message ?? resultLine) as Record<
            string,
            unknown
          >;
          const serial = message.serial as string | undefined;

          if (serial) {
            // Send a reaction
            await runCommand(
              [
                "rooms",
                "messages",
                "reactions",
                "send",
                testRoom,
                serial,
                "heart",
                "--client-id",
                client2Id,
              ],
              {
                env: { ABLY_API_KEY: E2E_API_KEY || "" },
                timeoutMs: 15000,
              },
            );

            // Wait for the reaction event in subscriber output
            await waitForOutput(subscriber, "heart", 15000);
          }
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );

    it("should remove a message reaction", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should remove a message reaction");

      // Send a message
      const sendResult = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          "remove-react-target",
          "--client-id",
          client1Id,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(sendResult.exitCode).toBe(0);

      const sendJsonLines = parseNdjsonLines(sendResult.stdout);
      const resultLine = sendJsonLines.find((l) => l.type === "result");
      expect(resultLine).toBeDefined();

      const message = (resultLine?.message ?? resultLine) as Record<
        string,
        unknown
      >;
      const serial = message.serial as string | undefined;
      expect(serial).toBeDefined();

      // Send a reaction first
      const addResult = await runCommand(
        [
          "rooms",
          "messages",
          "reactions",
          "send",
          testRoom,
          serial!,
          "thumbsup",
          "--client-id",
          client2Id,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 15000,
        },
      );

      expect(addResult.exitCode).toBe(0);

      // Remove the reaction
      const removeResult = await runCommand(
        [
          "rooms",
          "messages",
          "reactions",
          "remove",
          testRoom,
          serial!,
          "thumbsup",
          "--client-id",
          client2Id,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 15000,
        },
      );

      expect(removeResult.exitCode).toBe(0);
    });
  });
});
