import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:presence:update command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:presence:update", import.meta.url);
  standardArgValidationTests("rooms:presence:update", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:presence:update", import.meta.url, [
    "--data",
    "--json",
    "--duration",
    "--client-id",
  ]);

  describe("functionality", () => {
    it("should enter and update presence with data", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      const { stdout } = await runCommand(
        ["rooms:presence:update", "test-room", "--data", '{"status":"away"}'],
        import.meta.url,
      );

      expect(stdout).toContain("Entering and updating presence in room");
      expect(stdout).toContain("Updated");
      expect(stdout).toContain("test-room");
      expect(room.attach).toHaveBeenCalled();
      expect(room.presence.enter).toHaveBeenCalledWith({ status: "away" });
      expect(room.presence.update).toHaveBeenCalledWith({ status: "away" });
    });

    it("should show labeled output in human mode", async () => {
      const { stdout } = await runCommand(
        ["rooms:presence:update", "test-room", "--data", '{"status":"away"}'],
        import.meta.url,
      );

      expect(stdout).toContain("Client ID");
      expect(stdout).toContain("Connection ID");
      expect(stdout).toContain("Data");
      expect(stdout).toContain("Holding presence");
    });

    it("should output JSON with presenceMessage domain key", async () => {
      const allRecords = await captureJsonLogs(async () => {
        await runCommand(
          [
            "rooms:presence:update",
            "test-room",
            "--data",
            '{"status":"away"}',
            "--json",
          ],
          import.meta.url,
        );
      });

      const results = allRecords.filter((r) => r.type === "result");
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result.presenceMessage).toBeDefined();
      const msg = result.presenceMessage as Record<string, unknown>;
      expect(msg.action).toBe("update");
      expect(msg.room).toBe("test-room");
      expect(msg.clientId).toBeDefined();
      expect(msg.data).toEqual({ status: "away" });
    });

    it("should emit hold status in JSON mode", async () => {
      const allRecords = await captureJsonLogs(async () => {
        await runCommand(
          [
            "rooms:presence:update",
            "test-room",
            "--data",
            '{"status":"away"}',
            "--json",
          ],
          import.meta.url,
        );
      });

      const statusRecords = allRecords.filter((r) => r.type === "status");
      expect(statusRecords.length).toBeGreaterThanOrEqual(1);

      const status = statusRecords[0];
      expect(status.status).toBe("holding");
      expect(status.message).toContain("Holding presence");
    });

    it("should handle invalid JSON data gracefully", async () => {
      const { error } = await runCommand(
        ["rooms:presence:update", "test-room", "--data", "not-valid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/invalid|json/i);
    });

    it("should call attach before enter and update", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      await runCommand(
        ["rooms:presence:update", "test-room", "--data", '{"status":"away"}'],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.presence.enter).toHaveBeenCalled();
      expect(room.presence.update).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle presence enter errors", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");
      room.presence.enter.mockRejectedValue(new Error("Presence enter failed"));

      const { error } = await runCommand(
        ["rooms:presence:update", "test-room", "--data", '{"status":"away"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle presence update errors", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");
      room.presence.update.mockRejectedValue(
        new Error("Presence update failed"),
      );

      const { error } = await runCommand(
        ["rooms:presence:update", "test-room", "--data", '{"status":"away"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
