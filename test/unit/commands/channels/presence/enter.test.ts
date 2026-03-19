import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

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

  standardHelpTests("channels:presence:enter", import.meta.url);
  standardArgValidationTests("channels:presence:enter", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:presence:enter", import.meta.url, [
    "--data",
    "--json",
    "--duration",
    "--client-id",
    "--show-others",
    "--sequence-numbers",
  ]);

  describe("functionality", () => {
    it("should enter presence on a channel", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:presence:enter", "test-channel"],
        import.meta.url,
      );

      // Should show progress and successful entry
      expect(stdout).toContain("Entering presence on channel");
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

    it("should show client ID and connection ID labels in human output", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Client ID");
      expect(stdout).toContain("Connection ID");
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
        ["channels:presence:enter", "test-channel", "--show-others"],
        import.meta.url,
      );

      // Should show presence event from other client
      expect(stdout).toContain("other-client");
      expect(channel.presence.subscribe).toHaveBeenCalled();
    });

    it("should output JSON with presenceMessage domain key", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:presence:enter", "test-channel", "--json"],
        import.meta.url,
      );

      // Should not have errors - command runs successfully in JSON mode
      expect(channel.presence.enter).toHaveBeenCalled();

      // Parse JSON lines
      const lines = stdout.trim().split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const result = JSON.parse(lines[0]);
      expect(result.type).toBe("result");
      expect(result.presenceMessage).toBeDefined();
      expect(result.presenceMessage.action).toBe("enter");
      expect(result.presenceMessage.channel).toBe("test-channel");
      expect(result.presenceMessage.clientId).toBeDefined();
      expect(result.presenceMessage.connectionId).toBeDefined();
    });

    it("should emit hold status in JSON mode", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "test-channel", "--json"],
        import.meta.url,
      );

      const lines = stdout.trim().split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(2);

      const status = JSON.parse(lines[1]);
      expect(status.type).toBe("status");
      expect(status.status).toBe("holding");
      expect(status.message).toContain("Holding presence");
    });

    it("should handle invalid JSON data gracefully", async () => {
      const { error } = await runCommand(
        ["channels:presence:enter", "test-channel", "--data", "not-valid-json"],
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
        ["channels:presence:enter", "test-channel"],
        import.meta.url,
      );

      // Without --show-others, the command should not subscribe to presence events
      expect(channel.presence.subscribe).not.toHaveBeenCalled();
      // But should still show entry confirmation
      expect(stdout).toContain("Entered");
      expect(stdout).toContain("test-channel");
    });

    it("should show holding message without --show-others", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Holding presence");
    });

    it("should show listening message with --show-others", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "test-channel", "--show-others"],
        import.meta.url,
      );

      expect(stdout).toContain("Listening for presence events");
    });
  });

  describe("error handling", () => {
    it("should handle presence enter errors gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");
      channel.presence.enter.mockRejectedValue(
        new Error("Presence enter failed"),
      );

      const { error } = await runCommand(
        ["channels:presence:enter", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle capability error with --show-others gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      channel.presence.subscribe.mockRejectedValue(
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
        [
          "channels:presence:enter",
          "test-channel",
          "--client-id",
          "test-client",
          "--show-others",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
    });
  });
});
