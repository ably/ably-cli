import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:occupancy:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

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

  standardHelpTests("channels:occupancy:subscribe", import.meta.url);
  standardArgValidationTests("channels:occupancy:subscribe", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:occupancy:subscribe", import.meta.url, [
    "--json",
  ]);

  describe("functionality", () => {
    it("should subscribe to occupancy events and show initial message", async () => {
      const mock = getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to occupancy events on channel");
      expect(stdout).toContain("test-channel");
      expect(mock.channels.get).toHaveBeenCalledWith("test-channel", {
        params: { occupancy: "metrics" },
      });
    });

    it("should get channel with occupancy params enabled", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel", {
        params: {
          occupancy: "metrics",
        },
      });
    });

    it("should subscribe to [meta]occupancy event", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(channel.subscribe).toHaveBeenCalledWith(
        "[meta]occupancy",
        expect.any(Function),
      );
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      channel.subscribe.mockImplementation(() => {
        throw new Error("Subscription failed");
      });

      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock channels to simulate missing client
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });

    it("should handle capability error gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

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
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
      expect(error?.message).toContain("capability");
      expect(error?.message).toContain("Ably dashboard");
    });
  });

  describe("output formats", () => {
    it("should accept --json flag", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      // No flag-related error should occur
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should emit JSON envelope with type and command for occupancy events", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      // Capture the subscribe callback for [meta]occupancy
      let occupancyCallback: ((message: unknown) => void) | null = null;
      channel.subscribe.mockImplementation(
        (
          eventOrCallback: string | ((msg: unknown) => void),
          callback?: (msg: unknown) => void,
        ) => {
          if (typeof eventOrCallback === "string" && callback) {
            occupancyCallback = callback;
          }
        },
      );

      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:occupancy:subscribe", "test-channel", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(occupancyCallback).not.toBeNull();
        });

        occupancyCallback!({
          data: { connections: 5, publishers: 2 },
          timestamp: Date.now(),
        });

        await commandPromise;
      });
      const events = records.filter(
        (r) =>
          r.type === "event" && r.occupancy?.channelName === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "channels:occupancy:subscribe");
      expect(record.occupancy).toHaveProperty("channelName", "test-channel");
    });
  });
});
