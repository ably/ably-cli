import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:messages:delete command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:messages:delete", import.meta.url);
  standardArgValidationTests("rooms:messages:delete", import.meta.url, {
    requiredArgs: ["test-room", "serial-001"],
  });
  standardFlagTests("rooms:messages:delete", import.meta.url, [
    "--json",
    "--description",
  ]);

  describe("functionality", () => {
    it("should delete a message successfully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.delete.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      const { stdout } = await runCommand(
        ["rooms:messages:delete", "test-room", "serial-001"],
        import.meta.url,
      );

      expect(room.messages.delete).toHaveBeenCalledWith(
        "serial-001",
        undefined,
      );
      expect(stdout).toContain("deleted");
      expect(stdout).toContain("test-room");
    });

    it("should pass description as OperationDetails", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.delete.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      await runCommand(
        [
          "rooms:messages:delete",
          "test-room",
          "serial-001",
          "--description",
          "spam-removal",
        ],
        import.meta.url,
      );

      expect(room.messages.delete).toHaveBeenCalledWith("serial-001", {
        description: "spam-removal",
      });
    });

    it("should not pass details when no description", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.delete.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      await runCommand(
        ["rooms:messages:delete", "test-room", "serial-001"],
        import.meta.url,
      );

      expect(room.messages.delete).toHaveBeenCalledWith(
        "serial-001",
        undefined,
      );
    });

    it("should emit JSON envelope with --json", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.delete.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:delete", "test-room", "serial-001", "--json"],
          import.meta.url,
        );
      });

      const results = records.filter(
        (r) => r.type === "result" && r.message?.room === "test-room",
      );
      expect(results.length).toBeGreaterThan(0);
      const record = results[0];
      expect(record).toHaveProperty("type", "result");
      expect(record).toHaveProperty("command", "rooms:messages:delete");
      expect(record).toHaveProperty("success", true);
      expect(record.message).toHaveProperty("room", "test-room");
      expect(record.message).toHaveProperty("serial", "serial-001");
      expect(record.message).toHaveProperty(
        "versionSerial",
        "version-serial-001",
      );
    });

    it("should display version serial in human output", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.delete.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      const { stdout } = await runCommand(
        ["rooms:messages:delete", "test-room", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("version-serial-001");
    });
  });

  describe("error handling", () => {
    it("should handle API error", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.delete.mockRejectedValue(new Error("Delete failed"));

      const { error } = await runCommand(
        ["rooms:messages:delete", "test-room", "serial-001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Delete failed");
    });
  });
});
