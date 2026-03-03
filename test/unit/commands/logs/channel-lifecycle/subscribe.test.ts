import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

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

  describe("command flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --rewind flag", async () => {
      // The command might error due to connection, but should accept the flag
      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe", "--rewind", "10"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/Unknown flag/);
    });

    it("should accept --json flag", async () => {
      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe", "--json"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/Unknown flag/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to channel lifecycle events and show initial message", async () => {
      const { stdout } = await runCommand(
        ["logs:channel-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to");
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
  });
});
