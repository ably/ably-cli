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
import {
  SHOULD_SKIP_MUTABLE_TESTS,
  setupMutableMessagesRule,
  teardownMutableMessagesRule,
  getMutableChannelName,
  publishAndGetSerial,
} from "../../helpers/e2e-mutable-messages.js";

function findResult(stdout: string): Record<string, unknown> {
  const records = parseNdjsonLines(stdout);
  return records.find((r) => r.type === "result") ?? records.at(-1) ?? {};
}

describe.skipIf(SHOULD_SKIP_E2E || SHOULD_SKIP_MUTABLE_TESTS)(
  "Channel Annotations E2E Tests",
  () => {
    let channelName: string;
    let messageSerial: string;

    beforeAll(async () => {
      process.on("SIGINT", forceExit);

      // Create channel rule with mutableMessages enabled
      await setupMutableMessagesRule();

      // Publish a test message and get its serial for use in all tests
      channelName = getMutableChannelName("annotations");
      messageSerial = await publishAndGetSerial(channelName, "annotate-me");
    });

    afterAll(async () => {
      await teardownMutableMessagesRule();
      process.removeListener("SIGINT", forceExit);
    });

    beforeEach(() => {
      resetTestTracking();
    });

    afterEach(async () => {
      await cleanupTrackedResources();
    });

    it(
      "should publish an annotation on a message",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should publish an annotation on a message");

        const result = await runCommand(
          [
            "channels",
            "annotations",
            "publish",
            channelName,
            messageSerial,
            "reactions:flag.v1",
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const parsed = findResult(result.stdout);
        expect(parsed.success).toBe(true);
        expect(parsed.annotation).toBeDefined();

        const annotation = parsed.annotation as {
          channel: string;
          serial: string;
          type: string;
        };
        expect(annotation.channel).toBe(channelName);
        expect(annotation.serial).toBe(messageSerial);
        expect(annotation.type).toBe("reactions:flag.v1");
      },
    );

    it("should get annotations for a message", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should get annotations for a message");

      // First publish an annotation to ensure there is one
      const publishResult = await runCommand(
        [
          "channels",
          "annotations",
          "publish",
          channelName,
          messageSerial,
          "metrics:total.v1",
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );
      expect(publishResult.exitCode).toBe(0);

      // Wait for annotation to be indexed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await runCommand(
        [
          "channels",
          "annotations",
          "get",
          channelName,
          messageSerial,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const parsed = findResult(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.annotations).toBeDefined();
      expect(Array.isArray(parsed.annotations)).toBe(true);
    });

    it(
      "should delete an annotation on a message",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should delete an annotation on a message");

        // First publish an annotation to delete
        const annotationType = "receipts:flag.v1";
        const publishResult = await runCommand(
          [
            "channels",
            "annotations",
            "publish",
            channelName,
            messageSerial,
            annotationType,
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );
        expect(publishResult.exitCode).toBe(0);

        // Wait for annotation to be indexed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Now delete it
        const result = await runCommand(
          [
            "channels",
            "annotations",
            "delete",
            channelName,
            messageSerial,
            annotationType,
            "--json",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const parsed = findResult(result.stdout);
        expect(parsed.success).toBe(true);
        expect(parsed.annotation).toBeDefined();

        const annotation = parsed.annotation as {
          channel: string;
          serial: string;
          type: string;
        };
        expect(annotation.channel).toBe(channelName);
        expect(annotation.serial).toBe(messageSerial);
        expect(annotation.type).toBe(annotationType);
      },
    );

    it(
      "should subscribe to annotation events on a channel",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should subscribe to annotation events on a channel",
        );

        let subscriber: CliRunner | null = null;

        try {
          // Start subscribing to annotations
          subscriber = await startSubscribeCommand(
            [
              "channels",
              "annotations",
              "subscribe",
              channelName,
              "--duration",
              "30",
            ],
            /Listening for annotations/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Publish an annotation to trigger the subscriber
          const publishResult = await runCommand(
            [
              "channels",
              "annotations",
              "publish",
              channelName,
              messageSerial,
              "reactions:total.v1",
              "--json",
            ],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );
          expect(publishResult.exitCode).toBe(0);

          // Wait for the annotation event to appear in subscriber output
          await waitForOutput(subscriber, "total.v1", 15000);
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );
  },
);
