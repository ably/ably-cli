import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:presence:update command", () => {
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

  standardHelpTests("channels:presence:update", import.meta.url);
  standardArgValidationTests("channels:presence:update", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:presence:update", import.meta.url, [
    "--data",
    "--json",
    "--duration",
    "--client-id",
  ]);

  describe("functionality", () => {
    it("should enter and update presence with data", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          '{"status":"away"}',
        ],
        import.meta.url,
      );

      // Should show progress and successful update
      expect(stdout).toContain("Entering and updating presence on channel");
      expect(stdout).toContain("Updated");
      expect(stdout).toContain("test-channel");
      // Verify enter then update were called
      expect(channel.presence.enter).toHaveBeenCalled();
      expect(channel.presence.update).toHaveBeenCalledWith({
        status: "away",
      });
    });

    it("should show labeled output in human mode", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          '{"status":"away"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Client ID");
      expect(stdout).toContain("Connection ID");
      expect(stdout).toContain("Data");
      expect(stdout).toContain("Holding presence");
    });

    it("should output JSON with presenceMessage domain key", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          '{"status":"away"}',
          "--json",
        ],
        import.meta.url,
      );

      const lines = stdout.trim().split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const result = JSON.parse(lines[0]);
      expect(result.type).toBe("result");
      expect(result.presenceMessage).toBeDefined();
      expect(result.presenceMessage.action).toBe("update");
      expect(result.presenceMessage.channel).toBe("test-channel");
      expect(result.presenceMessage.clientId).toBeDefined();
      expect(result.presenceMessage.connectionId).toBeDefined();
      expect(result.presenceMessage.data).toEqual({ status: "away" });
    });

    it("should emit hold status in JSON mode", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          '{"status":"away"}',
          "--json",
        ],
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
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          "not-valid-json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/invalid|json/i);
    });
  });

  describe("error handling", () => {
    it("should handle presence enter errors", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");
      channel.presence.enter.mockRejectedValue(
        new Error("Presence enter failed"),
      );

      const { error } = await runCommand(
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          '{"status":"away"}',
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle presence update errors", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");
      channel.presence.update.mockRejectedValue(
        new Error("Presence update failed"),
      );

      const { error } = await runCommand(
        [
          "channels:presence:update",
          "test-channel",
          "--client-id",
          "test-client",
          "--data",
          '{"status":"away"}',
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
