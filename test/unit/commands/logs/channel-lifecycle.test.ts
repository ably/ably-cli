import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("logs:channel-lifecycle command", () => {
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
        ["logs:channel-lifecycle", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to [meta]channel.lifecycle and show initial message", async () => {
      // Emit SIGINT after a short delay to exit the command

      const { stdout } = await runCommand(
        ["logs:channel-lifecycle"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to");
      expect(stdout).toContain("[meta]channel.lifecycle");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should get channel without rewind params when --rewind is not specified", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(["logs:channel-lifecycle"], import.meta.url);

      // Verify channel was gotten with empty options (no rewind)
      expect(mock.channels.get).toHaveBeenCalledWith(
        "[meta]channel.lifecycle",
        {},
      );
    });

    it("should configure rewind channel option when --rewind is specified", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["logs:channel-lifecycle", "--rewind", "5"],
        import.meta.url,
      );

      // Verify channel was gotten with rewind params
      expect(mock.channels.get).toHaveBeenCalledWith(
        "[meta]channel.lifecycle",
        {
          params: {
            rewind: "5",
          },
        },
      );
    });

    it("should subscribe to channel messages", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]channel.lifecycle");

      await runCommand(["logs:channel-lifecycle"], import.meta.url);

      // Verify subscribe was called with a callback function
      expect(channel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]channel.lifecycle");
      channel.subscribe.mockImplementation(() => {
        throw new Error("Subscription failed");
      });

      const { error } = await runCommand(
        ["logs:channel-lifecycle"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["logs:channel-lifecycle"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });

  describe("cleanup behavior", () => {
    it("should call client.close on cleanup", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(["logs:channel-lifecycle"], import.meta.url);

      // Verify close was called during cleanup
      expect(mock.close).toHaveBeenCalled();
    });
  });

  describe("output formats", () => {
    it("should accept --json flag", async () => {
      const { error } = await runCommand(
        ["logs:channel-lifecycle", "--json"],
        import.meta.url,
      );

      // No flag-related error should occur
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
