import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

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

  describe("command arguments and flags", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
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
  });
});
