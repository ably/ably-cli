import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:occupancy:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-space::$space");

    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          callback();
        }
      },
    );

    channel.once.mockImplementation((event: string, callback: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        callback();
      }
    });
  });

  standardHelpTests("spaces:occupancy:subscribe", import.meta.url);

  standardArgValidationTests("spaces:occupancy:subscribe", import.meta.url, {
    requiredArgs: ["test-space"],
  });

  standardFlagTests("spaces:occupancy:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe and show initial messages", async () => {
      const { stdout } = await runCommand(
        ["spaces:occupancy:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to occupancy events on space");
      expect(stdout).toContain("test-space");
    });

    it("should get channel with mapped name and occupancy params", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["spaces:occupancy:subscribe", "test-space"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-space::$space", {
        params: { occupancy: "metrics" },
      });
    });

    it("should subscribe to [meta]occupancy event", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-space::$space");

      await runCommand(
        ["spaces:occupancy:subscribe", "test-space"],
        import.meta.url,
      );

      expect(channel.subscribe).toHaveBeenCalledWith(
        "[meta]occupancy",
        expect.any(Function),
      );
    });

    it("should emit JSON events with correct envelope", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-space::$space");

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
          ["spaces:occupancy:subscribe", "test-space", "--json"],
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

      const events = records.filter((r) => r.type === "event" && r.occupancy);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("type", "event");
      expect(events[0]).toHaveProperty("command", "spaces:occupancy:subscribe");
      const occupancy = events[0].occupancy as Record<string, unknown>;
      expect(occupancy).toHaveProperty("spaceName", "test-space");
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-space::$space");

      channel.subscribe.mockImplementation(() => {
        throw new Error("Subscription failed");
      });

      const { error } = await runCommand(
        ["spaces:occupancy:subscribe", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle capability errors", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-space::$space");

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
        ["spaces:occupancy:subscribe", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
    });
  });
});
