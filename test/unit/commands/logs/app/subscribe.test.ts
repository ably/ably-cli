import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("logs:app:subscribe command", () => {
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

  describe("command flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["logs:app:subscribe", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --rewind flag", async () => {
      // Run with --duration 0 to exit immediately
      const { error } = await runCommand(
        ["logs:app:subscribe", "--rewind", "10", "--duration", "0"],
        import.meta.url,
      );

      // The command might error due to connection issues, but it should accept the flag
      expect(error?.message || "").not.toMatch(/Unknown flag/);
    });

    it("should accept --type flag with valid option", async () => {
      const { error } = await runCommand(
        [
          "logs:app:subscribe",
          "--type",
          "channel.lifecycle",
          "--duration",
          "0",
        ],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/Unknown flag/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to log channel and show initial message", async () => {
      const { stdout } = await runCommand(
        ["logs:app:subscribe"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to app logs");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should subscribe to specific log types", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]log");

      await runCommand(
        ["logs:app:subscribe", "--type", "channel.lifecycle"],
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

      await runCommand(
        ["logs:app:subscribe", "--rewind", "10"],
        import.meta.url,
      );

      // Verify channel was gotten with rewind params
      expect(mock.channels.get).toHaveBeenCalledWith("[meta]log", {
        params: { rewind: "10" },
      });
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["logs:app:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
