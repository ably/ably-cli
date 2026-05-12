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
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";
import {
  SHOULD_SKIP_MUTABLE_TESTS,
  setupMutableMessagesRule,
  teardownMutableMessagesRule,
  getMutableChannelName,
  publishAndGetSerial,
} from "../../helpers/e2e-mutable-messages.js";

describe.skipIf(SHOULD_SKIP_E2E || SHOULD_SKIP_MUTABLE_TESTS)(
  "Channel Message Operations E2E Tests",
  () => {
    let channelName: string;
    let messageSerial: string;

    beforeAll(async () => {
      // Create channel rule with mutableMessages enabled
      await setupMutableMessagesRule();

      // Publish a test message and get its serial for use in all tests
      channelName = getMutableChannelName("msg-ops");
      messageSerial = await publishAndGetSerial(channelName, "test-msg");
    });

    afterAll(async () => {
      await teardownMutableMessagesRule();
    });

    beforeEach(() => {
      resetTestTracking();
    });

    afterEach(async () => {
      await cleanupTrackedResources();
    });

    it(
      "should update a message via channels update",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should update a message via channels update");

        const result = await runCommand(
          [
            "channels",
            "update",
            channelName,
            messageSerial,
            "updated-text",
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const records = parseNdjsonLines(result.stdout);
        const parsed = records.find((r) => r.type === "result") ?? records[0];
        expect(parsed.success).toBe(true);
        expect(parsed.message).toBeDefined();
      },
    );

    it(
      "should append to a message via channels append",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should append to a message via channels append",
        );

        const result = await runCommand(
          [
            "channels",
            "append",
            channelName,
            messageSerial,
            "appended-text",
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const records = parseNdjsonLines(result.stdout);
        const parsed = records.find((r) => r.type === "result") ?? records[0];
        expect(parsed.success).toBe(true);
        expect(parsed.message).toBeDefined();
      },
    );

    it(
      "should retrieve a message via channels get-message",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should retrieve a message via channels get-message",
        );

        // Use a fresh channel/serial so we don't see updates from other tests
        const getChannel = getMutableChannelName("msg-get");
        const serial = await publishAndGetSerial(getChannel, "fresh-message");

        const result = await runCommand(
          ["channels", "get-message", getChannel, serial, "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const records = parseNdjsonLines(result.stdout);
        const parsed = records.find((r) => r.type === "result") ?? records[0];
        expect(parsed.success).toBe(true);
        expect(parsed.message).toBeDefined();
        const message = parsed.message as Record<string, unknown>;
        expect(message.serial).toBe(serial);
        expect(message.data).toBe("fresh-message");
        // Timestamp must be ISO 8601 (history-style normalisation)
        expect(message.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
      },
    );

    it(
      "should return the latest version after an update via channels get-message",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should return the latest version after an update via channels get-message",
        );

        // Publish, update, then verify get-message returns the updated payload
        const updateChannel = getMutableChannelName("msg-get-after-update");
        const serial = await publishAndGetSerial(updateChannel, "original");

        const updateResult = await runCommand(
          [
            "channels",
            "update",
            updateChannel,
            serial,
            "edited-text",
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );
        expect(updateResult.exitCode).toBe(0);

        // Retry get-message — update is eventually consistent
        let latestMessage: Record<string, unknown> | undefined;
        for (let attempt = 0; attempt < 10; attempt++) {
          const getResult = await runCommand(
            ["channels", "get-message", updateChannel, serial, "--json"],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );
          if (getResult.exitCode === 0) {
            const records = parseNdjsonLines(getResult.stdout);
            const parsed =
              records.find((r) => r.type === "result") ?? records[0];
            latestMessage = parsed.message as
              | Record<string, unknown>
              | undefined;
            if (latestMessage?.data === "edited-text") break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        expect(latestMessage).toBeDefined();
        expect(latestMessage!.data).toBe("edited-text");
        // The action must reflect that this is an update, not the original create
        expect(latestMessage!.action).toBe("message.update");
        // The version block must be populated and differ from the message serial
        expect(latestMessage!.version).toBeDefined();
        const version = latestMessage!.version as Record<string, unknown>;
        expect(version.serial).toBeDefined();
        expect(version.serial).not.toBe(serial);
      },
    );

    it(
      "should render human-readable output without --json",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should render human-readable output without --json",
        );

        const humanChannel = getMutableChannelName("msg-get-human");
        const serial = await publishAndGetSerial(humanChannel, "human-text");

        const result = await runCommand(
          ["channels", "get-message", humanChannel, serial],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);
        // Field labels rendered by formatMessagesOutput must appear
        expect(result.stdout).toContain("Channel");
        expect(result.stdout).toContain("Serial");
        expect(result.stdout).toContain(serial);
        expect(result.stdout).toContain("Data");
        expect(result.stdout).toContain("human-text");
      },
    );

    it(
      "should fail with a non-zero exit code for an unknown serial",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should fail with a non-zero exit code for an unknown serial",
        );

        const result = await runCommand(
          [
            "channels",
            "get-message",
            channelName,
            "0000000000-000@deadbeef:000",
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).not.toBe(0);

        const records = parseNdjsonLines(result.stdout);
        const errorRecord = records.find((r) => r.type === "error");
        expect(errorRecord).toBeDefined();
        expect(errorRecord!.success).toBe(false);
      },
    );

    it(
      "should delete a message via channels delete",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should delete a message via channels delete");

        // Publish a fresh message to delete (so we don't conflict with update/append tests)
        const deleteChannel = getMutableChannelName("msg-delete");
        const serial = await publishAndGetSerial(deleteChannel, "to-delete");

        const result = await runCommand(
          ["channels", "delete", deleteChannel, serial, "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const records = parseNdjsonLines(result.stdout);
        const parsed = records.find((r) => r.type === "result") ?? records[0];
        expect(parsed.success).toBe(true);
        expect(parsed.message).toBeDefined();
      },
    );
  },
);
