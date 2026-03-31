import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("logs:channel-lifecycle:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]channel.lifecycle");

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

  standardHelpTests("logs:channel-lifecycle:subscribe", import.meta.url);
  standardArgValidationTests(
    "logs:channel-lifecycle:subscribe",
    import.meta.url,
  );
  standardFlagTests("logs:channel-lifecycle:subscribe", import.meta.url, [
    "--rewind",
    "--json",
  ]);

  describe("functionality", () => {
    it("should subscribe to channel lifecycle events and show initial message", async () => {
      const { stdout } = await runCommand(
        ["logs:channel-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribed to");
      expect(stdout).toContain("[meta]channel.lifecycle");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should subscribe to channel messages", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]channel.lifecycle");

      await runCommand(["logs:channel-lifecycle:subscribe"], import.meta.url);

      expect(channel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should configure rewind when --rewind is specified", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["logs:channel-lifecycle:subscribe", "--rewind", "5"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith(
        "[meta]channel.lifecycle",
        {
          params: { rewind: "5" },
        },
      );
    });
  });

  describe("JSON output", () => {
    it("should emit JSON envelope with type and command for lifecycle events", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]channel.lifecycle");

      let messageCallback: ((message: unknown) => void) | null = null;
      channel.subscribe.mockImplementation(
        (callback: (message: unknown) => void) => {
          messageCallback = callback;
        },
      );

      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["logs:channel-lifecycle:subscribe", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(messageCallback).not.toBeNull();
        });

        messageCallback!({
          name: "channel.attached",
          data: { channelName: "test-ch" },
          timestamp: Date.now(),
        });

        await commandPromise;
      });
      const events = records.filter(
        (r) => r.type === "event" && r.log?.event === "channel.attached",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty(
        "command",
        "logs:channel-lifecycle:subscribe",
      );
      expect(record).toHaveProperty("log");
      expect(record.log).toHaveProperty("event", "channel.attached");
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });

    it("should handle capability error gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]channel.lifecycle");

      channel.subscribe.mockRejectedValue(
        Object.assign(
          new Error("Channel denied access based on given capability"),
          {
            code: 40160,
            statusCode: 401,
            href: "https://help.ably.io/error/40160",
          },
        ),
      );

      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
    });
  });
});
