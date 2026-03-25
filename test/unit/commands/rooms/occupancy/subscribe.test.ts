import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:occupancy:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-room::$chat");

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

  standardHelpTests("rooms:occupancy:subscribe", import.meta.url);
  standardArgValidationTests("rooms:occupancy:subscribe", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:occupancy:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to occupancy events and show initial message", async () => {
      const mock = getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to occupancy events on room");
      expect(stdout).toContain("test-room");
      expect(mock.channels.get).toHaveBeenCalledWith("test-room::$chat", {
        params: { occupancy: "metrics" },
      });
    });

    it("should subscribe to [meta]occupancy event", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-room::$chat");

      await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(channel.subscribe).toHaveBeenCalledWith(
        "[meta]occupancy",
        expect.any(Function),
      );
    });

    it("should not fetch initial occupancy (passive observer)", async () => {
      getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      // Should NOT contain initial snapshot text (subscribe = passive observer)
      expect(stdout).not.toContain("Initial occupancy");
      // Should show listening message
      expect(stdout).toContain("Listening");
    });

    it("should emit JSON envelope with occupancy nesting for events", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-room::$chat");

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
          ["rooms:occupancy:subscribe", "test-room", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(occupancyCallback).not.toBeNull();
        });

        occupancyCallback!({
          data: {
            metrics: {
              connections: 5,
              publishers: 2,
              subscribers: 3,
              presenceConnections: 1,
              presenceMembers: 4,
              presenceSubscribers: 0,
            },
          },
          timestamp: Date.now(),
        });

        await commandPromise;
      });

      const events = records.filter(
        (r) => r.type === "event" && r.occupancy?.roomName === "test-room",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "rooms:occupancy:subscribe");
      expect(record.occupancy).toHaveProperty("roomName", "test-room");
      expect(record.occupancy).toHaveProperty("event", "[meta]occupancy");
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-room::$chat");

      channel.subscribe.mockImplementation(() => {
        throw new Error("Subscription failed");
      });

      const { error } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle missing mock client in test mode", async () => {
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
