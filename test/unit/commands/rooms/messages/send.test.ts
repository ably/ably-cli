import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";

describe("rooms:messages:send command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("help", () => {
    it("should show usage when --help is passed", async () => {
      const { stdout } = await runCommand(
        ["rooms:messages:send", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:send"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require text argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:send", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:messages:send", "test-room", "hello", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should send a single message successfully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      const { stdout } = await runCommand(
        ["rooms:messages:send", "test-room", "HelloWorld"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.send).toHaveBeenCalledWith({
        text: "HelloWorld",
      });
      expect(stdout).toContain("Message sent to room test-room");
    });

    it("should send message with metadata", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "ImportantMessage",
          "--metadata",
          '{"isImportant":true}',
        ],
        import.meta.url,
      );

      expect(room.messages.send).toHaveBeenCalledWith({
        text: "ImportantMessage",
        metadata: { isImportant: true },
      });
    });

    it("should send multiple messages with interpolation", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const sentTexts: string[] = [];
      room.messages.send.mockImplementation(
        async (params: { text: string }) => {
          sentTexts.push(params.text);
          return { serial: "msg-serial", createdAt: Date.now() };
        },
      );

      const { stdout } = await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "Message{{.Count}}",
          "--count",
          "3",
          "--delay",
          "40",
        ],
        import.meta.url,
      );

      expect(room.messages.send).toHaveBeenCalledTimes(3);
      expect(sentTexts).toContain("Message1");
      expect(sentTexts).toContain("Message2");
      expect(sentTexts).toContain("Message3");
      expect(stdout).toContain("3/3 messages sent to room test-room");
    });

    it("should emit JSON envelope with type result for --json single send", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:send", "test-room", "HelloJSON", "--json"],
          import.meta.url,
        );
      });

      const results = records.filter(
        (r) => r.type === "result" && r.room === "test-room",
      );
      expect(results.length).toBeGreaterThan(0);
      const record = results[0];
      expect(record).toHaveProperty("type", "result");
      expect(record).toHaveProperty("command", "rooms:messages:send");
      expect(record).toHaveProperty("success", true);
      expect(record).toHaveProperty("room", "test-room");
    });
  });

  describe("flags", () => {
    it("should accept --count flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "TestMsg",
          "--count",
          "2",
          "--delay",
          "40",
        ],
        import.meta.url,
      );

      expect(room.messages.send).toHaveBeenCalledTimes(2);
    });

    it("should enforce minimum 40ms delay for multiple messages", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      const startTime = Date.now();
      await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "Message{{.Count}}",
          "--count",
          "3",
          "--delay",
          "10",
        ],
        import.meta.url,
      );
      const totalTime = Date.now() - startTime;

      expect(room.messages.send).toHaveBeenCalledTimes(3);
      // Minimum 40ms delay enforced, so at least 80ms for 2 gaps between 3 messages
      expect(totalTime).toBeGreaterThanOrEqual(80);
    });

    it("should accept --delay flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      const startTime = Date.now();
      await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "Message{{.Count}}",
          "--count",
          "3",
          "--delay",
          "100",
        ],
        import.meta.url,
      );
      const totalTime = Date.now() - startTime;

      expect(room.messages.send).toHaveBeenCalledTimes(3);
      expect(totalTime).toBeGreaterThanOrEqual(200);
    });
  });

  describe("error handling", () => {
    it("should handle invalid metadata JSON", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "TestMessage",
          "--metadata",
          "invalid-json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid metadata JSON/i);
    });

    it("should handle send failure for single message", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockRejectedValue(new Error("Send failed"));

      const { error } = await runCommand(
        ["rooms:messages:send", "test-room", "TestMessage"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Send failed");
    });

    it("should continue sending remaining messages on error", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      let callCount = 0;
      const sentTexts: string[] = [];

      room.messages.send.mockImplementation(
        async (params: { text: string }) => {
          callCount++;
          if (callCount === 3) {
            throw new Error("Network error");
          }
          sentTexts.push(params.text);
          return { serial: "msg-serial", createdAt: Date.now() };
        },
      );

      await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "Message{{.Count}}",
          "--count",
          "5",
          "--delay",
          "40",
        ],
        import.meta.url,
      );

      // Should have attempted all 5, but only 4 succeeded
      expect(room.messages.send).toHaveBeenCalledTimes(5);
      expect(sentTexts).toHaveLength(4);
    });

    it("should output JSON error on single send failure with --json", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockRejectedValue(new Error("Send failed"));

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:send", "test-room", "TestMessage", "--json"],
          import.meta.url,
        );
      });

      const errors = records.filter(
        (r) => r.type === "error" || r.success === false,
      );
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
