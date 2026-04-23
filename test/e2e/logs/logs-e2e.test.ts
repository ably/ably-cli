import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  runCommand,
  startSubscribeCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Logs E2E Tests", () => {
  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("logs history", () => {
    it("should retrieve application log history", async () => {
      setupTestFailureHandler("should retrieve application log history");

      const result = await runCommand(["logs", "history", "--json"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 15000,
      });

      // Should succeed even if empty
      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(Array.isArray(resultRecord!.messages)).toBe(true);
      expect(resultRecord).toHaveProperty("hasMore");
    });
  });

  describe("logs subscribe", () => {
    it(
      "should subscribe to live application logs",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should subscribe to live application logs");

        let subscriber: CliRunner | null = null;

        try {
          // Start subscribing to logs
          subscriber = await startSubscribeCommand(
            ["logs", "subscribe", "--rewind", "1", "--duration", "30"],
            /Listening for log events/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // The subscriber connected successfully - that's the smoke test
          expect(subscriber.isRunning()).toBe(true);
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );
  });

  describe("logs channel-lifecycle subscribe", () => {
    it(
      "should subscribe to channel lifecycle events",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler("should subscribe to channel lifecycle events");

        let subscriber: CliRunner | null = null;

        try {
          subscriber = await startSubscribeCommand(
            ["logs", "channel-lifecycle", "subscribe", "--duration", "30"],
            /Listening for channel lifecycle/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          expect(subscriber.isRunning()).toBe(true);

          // Trigger a channel lifecycle event by publishing to a new channel
          const channelName = getUniqueChannelName("lifecycle-trigger");
          await runCommand(["channels", "publish", channelName, "trigger"], {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 15000,
          });
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );
  });

  describe("logs connection-lifecycle", () => {
    it(
      "should subscribe to connection lifecycle events",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should subscribe to connection lifecycle events",
        );

        let subscriber: CliRunner | null = null;

        try {
          subscriber = await startSubscribeCommand(
            ["logs", "connection-lifecycle", "subscribe", "--duration", "30"],
            /Listening for connection lifecycle/,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          expect(subscriber.isRunning()).toBe(true);
        } finally {
          if (subscriber) {
            await cleanupRunners([subscriber]);
          }
        }
      },
    );

    it("should retrieve connection lifecycle history", async () => {
      setupTestFailureHandler("should retrieve connection lifecycle history");

      const result = await runCommand(
        ["logs", "connection-lifecycle", "history", "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 15000,
        },
      );

      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(Array.isArray(resultRecord!.messages)).toBe(true);
      expect(resultRecord).toHaveProperty("hasMore");
    });
  });

  describe("logs push", () => {
    it("should retrieve push log history", async () => {
      setupTestFailureHandler("should retrieve push log history");

      const result = await runCommand(["logs", "push", "history", "--json"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 15000,
      });

      // Should succeed even if empty
      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(Array.isArray(resultRecord!.messages)).toBe(true);
      expect(resultRecord).toHaveProperty("hasMore");
    });

    it("should subscribe to push logs", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should subscribe to push logs");

      let subscriber: CliRunner | null = null;

      try {
        subscriber = await startSubscribeCommand(
          ["logs", "push", "subscribe", "--duration", "30"],
          /Listening for push logs/,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(subscriber.isRunning()).toBe(true);
      } finally {
        if (subscriber) {
          await cleanupRunners([subscriber]);
        }
      }
    });
  });
});
