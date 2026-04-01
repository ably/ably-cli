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
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Messages E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let testRoom: string;
  let clientId: string;

  beforeEach(() => {
    resetTestTracking();
    testRoom = getUniqueChannelName("room-msg");
    clientId = getUniqueClientId("msg-client");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms messages send and history", () => {
    it("should send a message to a room", async () => {
      setupTestFailureHandler("should send a message to a room");

      const result = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          "hello-e2e-test",
          "--client-id",
          clientId,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
    });

    it(
      "should retrieve message history for a room",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should retrieve message history for a room");

        // First send a message
        await runCommand(
          [
            "rooms",
            "messages",
            "send",
            testRoom,
            "history-test-msg",
            "--client-id",
            clientId,
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Wait a moment for the message to be available in history
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get history
        const historyResult = await runCommand(
          ["rooms", "messages", "history", testRoom, "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(historyResult.exitCode).toBe(0);
        const jsonLines = parseNdjsonLines(historyResult.stdout);
        expect(jsonLines.length).toBeGreaterThan(0);
      },
    );
  });

  describe("rooms messages update and delete", () => {
    it("should update a room message", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should update a room message");

      // Send a message and get its serial from the JSON response
      const sendResult = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          "original-msg",
          "--client-id",
          clientId,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(sendResult.exitCode).toBe(0);

      // Parse the serial from the send result
      const sendJsonLines = parseNdjsonLines(sendResult.stdout);
      const resultLine = sendJsonLines.find((l) => l.type === "result");
      expect(resultLine).toBeDefined();

      // Extract serial - it could be nested under a domain key
      const message = (resultLine?.message ?? resultLine) as Record<
        string,
        unknown
      >;
      const serial = message.serial as string | undefined;
      expect(serial).toBeDefined();

      // Update the message
      const updateResult = await runCommand(
        [
          "rooms",
          "messages",
          "update",
          testRoom,
          serial!,
          "updated-msg",
          "--client-id",
          clientId,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(updateResult.exitCode).toBe(0);
    });

    it("should delete a room message", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should delete a room message");

      // Send a message
      const sendResult = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          "to-delete-msg",
          "--client-id",
          clientId,
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

      // Delete the message
      const deleteResult = await runCommand(
        [
          "rooms",
          "messages",
          "delete",
          testRoom,
          serial!,
          "--client-id",
          clientId,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(deleteResult.exitCode).toBe(0);
    });
  });
});
