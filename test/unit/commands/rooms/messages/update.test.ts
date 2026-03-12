import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:messages:update command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:messages:update", import.meta.url);
  standardArgValidationTests("rooms:messages:update", import.meta.url, {
    requiredArgs: ["test-room", "serial-001", "updated-text"],
  });
  standardFlagTests("rooms:messages:update", import.meta.url, [
    "--json",
    "--metadata",
    "--headers",
    "--description",
  ]);

  describe("functionality", () => {
    it("should update a message successfully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      const { stdout } = await runCommand(
        ["rooms:messages:update", "test-room", "serial-001", "updated-text"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.update).toHaveBeenCalledWith(
        "serial-001",
        { text: "updated-text" },
        undefined,
      );
      expect(stdout).toContain("updated");
      expect(stdout).toContain("test-room");
    });

    it("should pass metadata when --metadata provided", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--metadata",
          '{"edited":true}',
        ],
        import.meta.url,
      );

      expect(room.messages.update).toHaveBeenCalledWith(
        "serial-001",
        { text: "updated-text", metadata: { edited: true } },
        undefined,
      );
    });

    it("should pass headers when --headers provided", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--headers",
          '{"source":"cli"}',
        ],
        import.meta.url,
      );

      expect(room.messages.update).toHaveBeenCalledWith(
        "serial-001",
        { text: "updated-text", headers: { source: "cli" } },
        undefined,
      );
    });

    it("should pass description as OperationDetails", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--description",
          "typo-fix",
        ],
        import.meta.url,
      );

      expect(room.messages.update).toHaveBeenCalledWith(
        "serial-001",
        { text: "updated-text" },
        { description: "typo-fix" },
      );
    });

    it("should not pass details when no description", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      await runCommand(
        ["rooms:messages:update", "test-room", "serial-001", "updated-text"],
        import.meta.url,
      );

      expect(room.messages.update).toHaveBeenCalledWith(
        "serial-001",
        { text: "updated-text" },
        undefined,
      );
    });

    it("should emit JSON envelope with --json", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      const records = await captureJsonLogs(async () => {
        await runCommand(
          [
            "rooms:messages:update",
            "test-room",
            "serial-001",
            "updated-text",
            "--json",
          ],
          import.meta.url,
        );
      });

      const results = records.filter(
        (r) => r.type === "result" && r.room === "test-room",
      );
      expect(results.length).toBeGreaterThan(0);
      const record = results[0];
      expect(record).toHaveProperty("type", "result");
      expect(record).toHaveProperty("command", "rooms:messages:update");
      expect(record).toHaveProperty("success", true);
      expect(record).toHaveProperty("room", "test-room");
      expect(record).toHaveProperty("serial", "serial-001");
      expect(record).toHaveProperty("versionSerial", "version-serial-001");
    });

    it("should display version serial in human output", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockResolvedValue({
        serial: "serial-001",
        clientId: "mock-client-id",
        text: "updated-text",
        timestamp: new Date(),
        version: { serial: "version-serial-001", timestamp: new Date() },
      });

      const { stdout } = await runCommand(
        ["rooms:messages:update", "test-room", "serial-001", "updated-text"],
        import.meta.url,
      );

      expect(stdout).toContain("version-serial-001");
    });
  });

  describe("error handling", () => {
    it("should handle invalid metadata JSON", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--metadata",
          "invalid-json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid metadata JSON/i);
    });

    it("should reject non-object metadata", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--metadata",
          "42",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Metadata must be a JSON object/i);
    });

    it("should reject array metadata", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--metadata",
          "[1,2,3]",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Metadata must be a JSON object/i);
    });

    it("should handle invalid headers JSON", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--headers",
          "invalid-json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid headers JSON/i);
    });

    it("should reject non-object headers", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--headers",
          "42",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Headers must be a JSON object/i);
    });

    it("should reject array headers", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:update",
          "test-room",
          "serial-001",
          "updated-text",
          "--headers",
          "[1,2,3]",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Headers must be a JSON object/i);
    });

    it("should handle API error", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.update.mockRejectedValue(new Error("Update failed"));

      const { error } = await runCommand(
        ["rooms:messages:update", "test-room", "serial-001", "updated-text"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Update failed");
    });
  });
});
