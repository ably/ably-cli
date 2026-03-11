import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("logs:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]log");

    // Configure connection.once to immediately call callback for 'connected'
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          callback();
        }
      },
    );

    // Configure channel.once to immediately call callback for 'attached'
    channel.once.mockImplementation((event: string, callback: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        callback();
      }
    });
  });

  standardHelpTests("logs:subscribe", import.meta.url);
  standardArgValidationTests("logs:subscribe", import.meta.url);
  standardFlagTests("logs:subscribe", import.meta.url, [
    "--rewind",
    "--type",
    "--json",
  ]);

  describe("functionality", () => {
    it("should subscribe to log channel and show initial message", async () => {
      const { stdout } = await runCommand(["logs:subscribe"], import.meta.url);

      expect(stdout).toContain("Subscribed to app logs");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should subscribe to specific log types", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]log");

      await runCommand(
        ["logs:subscribe", "--type", "channel.lifecycle"],
        import.meta.url,
      );

      // Verify subscribe was called with the specific type
      expect(channel.subscribe).toHaveBeenCalledWith(
        "channel.lifecycle",
        expect.any(Function),
      );
    });

    it("should configure rewind when --rewind is specified", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(["logs:subscribe", "--rewind", "10"], import.meta.url);

      // Verify channel was gotten with rewind params
      expect(mock.channels.get).toHaveBeenCalledWith("[meta]log", {
        params: { rewind: "10" },
      });
    });
  });

  describe("rewind and type filtering", () => {
    it("should set rewind channel param when --rewind > 0", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(["logs:subscribe", "--rewind", "5"], import.meta.url);

      expect(mock.channels.get).toHaveBeenCalledWith("[meta]log", {
        params: { rewind: "5" },
      });
    });

    it("should subscribe only to --type when provided", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]log");

      await runCommand(
        ["logs:subscribe", "--type", "channel.presence"],
        import.meta.url,
      );

      // Should only subscribe to the specified type
      expect(channel.subscribe).toHaveBeenCalledWith(
        "channel.presence",
        expect.any(Function),
      );
      // Should NOT subscribe to other types
      const subscribeCalls = channel.subscribe.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string",
      );
      expect(subscribeCalls).toHaveLength(1);
      expect(subscribeCalls[0][0]).toBe("channel.presence");
    });

    it("should subscribe to all log types without --type", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]log");

      await runCommand(["logs:subscribe"], import.meta.url);

      // Should subscribe to all 5 default log types
      const subscribeCalls = channel.subscribe.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string",
      );
      expect(subscribeCalls.length).toBe(5);

      const subscribedTypes = subscribeCalls.map((call: unknown[]) => call[0]);
      expect(subscribedTypes).toContain("channel.lifecycle");
      expect(subscribedTypes).toContain("channel.occupancy");
      expect(subscribedTypes).toContain("channel.presence");
      expect(subscribedTypes).toContain("connection.lifecycle");
      expect(subscribedTypes).toContain("push.publish");
    });
  });

  describe("JSON output", () => {
    it("should emit JSON envelope with command for --json events", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]log");

      // Capture the subscribe callback for channel.lifecycle type
      let logCallback: ((message: unknown) => void) | null = null;
      channel.subscribe.mockImplementation(
        (
          eventOrCallback: string | ((msg: unknown) => void),
          callback?: (msg: unknown) => void,
        ) => {
          if (
            typeof eventOrCallback === "string" &&
            eventOrCallback === "channel.lifecycle" &&
            callback
          ) {
            logCallback = callback;
          }
        },
      );

      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["logs:subscribe", "--type", "channel.lifecycle", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(logCallback).not.toBeNull();
        });

        logCallback!({
          name: "channel.lifecycle",
          data: { channelName: "test-ch", state: "attached" },
          timestamp: Date.now(),
          id: "log-123",
        });

        await commandPromise;
      });
      const events = records.filter(
        (r) => r.type === "event" && r.logType === "channel.lifecycle",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "logs:subscribe");
      expect(record).toHaveProperty("logType", "channel.lifecycle");
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(["logs:subscribe"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
