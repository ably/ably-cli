import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("channels:presence:enter command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure presence methods
    channel.presence.get.mockResolvedValue([
      { clientId: "other-client", data: { status: "online" } },
    ]);

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

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Enter presence on a channel");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("CHANNEL");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("presence enter");
    });

    it("should show channel argument is required", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("CHANNEL");
    });
  });

  describe("presence enter functionality", () => {
    it("should enter presence on a channel", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Should show successful entry
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("Entered");
      // Verify presence.enter was called
      expect(channel.presence.enter).toHaveBeenCalled();
    });

    it("should enter presence with data", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--data",
          '{"status":"online","name":"TestUser"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Entered");
      // Verify presence.enter was called with the data
      expect(channel.presence.enter).toHaveBeenCalledWith({
        status: "online",
        name: "TestUser",
      });
    });

    it("should show presence events when --show-others flag is passed", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      // Set up the mock to capture the callback and trigger a presence event
      channel.presence.subscribe.mockImplementation(
        (callback: (message: unknown) => void) => {
          // Trigger a presence event after a short delay
          setTimeout(() => {
            callback({
              action: "enter",
              clientId: "other-client",
              data: { status: "online" },
              timestamp: Date.now(),
            });
          }, 50);
        },
      );

      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--show-others",
        ],
        import.meta.url,
      );

      // Should show presence event from other client
      expect(stdout).toContain("other-client");
      expect(channel.presence.subscribe).toHaveBeenCalled();
    });

    it("should run with --json flag without errors", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { error } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      // Should not have errors - command runs successfully in JSON mode
      expect(error).toBeUndefined();
      // Verify presence.enter was still called
      expect(channel.presence.enter).toHaveBeenCalled();
    });

    it("should handle invalid JSON data gracefully", async () => {
      const { error } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--data",
          "not-valid-json",
        ],
        import.meta.url,
      );

      // Should throw an error for invalid JSON
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/invalid|json/i);
    });

    it("should not subscribe to presence events without --show-others flag", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Without --show-others, the command should not subscribe to presence events
      expect(channel.presence.subscribe).not.toHaveBeenCalled();
      // But should still show entry confirmation
      expect(stdout).toContain("Entered");
      expect(stdout).toContain("test-channel");
    });
  });

  describe("flags", () => {
    it("should accept --data flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--data");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept --duration flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--duration");
    });
  });
});
