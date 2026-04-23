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
