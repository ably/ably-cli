import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../../helpers/mock-ably-chat.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../../helpers/standard-tests.js";

describe("rooms:messages:reactions:send command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:messages:reactions:send", import.meta.url);
  standardArgValidationTests("rooms:messages:reactions:send", import.meta.url, {
    requiredArgs: ["test-room", "msg-serial", "thumbsup"],
  });
  standardFlagTests("rooms:messages:reactions:send", import.meta.url, [
    "--json",
    "--type",
  ]);

  describe("functionality", () => {
    it("should send a reaction to a message", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      // Configure message reactions send mock
      room.messages.reactions.send.mockImplementation(async () => {});

      const { stderr } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial-123", "👍"],
        import.meta.url,
      );

      expect(room.attach).not.toHaveBeenCalled();
      expect(room.messages.reactions.send).toHaveBeenCalledWith(
        "msg-serial-123",
        {
          name: "👍",
        },
      );
      expect(stderr).toContain("Sent reaction");
      expect(stderr).toContain("👍");
      expect(stderr).toContain("msg-serial-123");
      expect(stderr).toContain("test-room");
    });

    it("should send a reaction with type flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.send.mockImplementation(async () => {});

      const { stderr } = await runCommand(
        [
          "rooms:messages:reactions:send",
          "test-room",
          "msg-serial-123",
          "❤️",
          "--type",
          "unique",
        ],
        import.meta.url,
      );

      expect(room.messages.reactions.send).toHaveBeenCalledWith(
        "msg-serial-123",
        {
          name: "❤️",
          type: expect.any(String),
        },
      );
      expect(stderr).toContain("Sent reaction");
      expect(stderr).toContain("❤️");
    });

    it("should output JSON when --json flag is used", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.send.mockImplementation(async () => {});

      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:send",
          "test-room",
          "msg-serial-123",
          "👍",
          "--json",
        ],
        import.meta.url,
      );

      const lines = stdout.trim().split("\n");
      const result = JSON.parse(lines[0]);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("reaction");
      expect(result.reaction).toHaveProperty("room", "test-room");
      expect(result.reaction).toHaveProperty("messageSerial", "msg-serial-123");
      expect(result.reaction).toHaveProperty("name", "👍");
    });

    it("should handle reaction send failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.send.mockRejectedValue(
        new Error("Failed to send reaction"),
      );

      const { error } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial-123", "👍"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to send reaction");
    });
  });

  describe("error handling", () => {
    it("should handle reaction send failure gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.messages.reactions.send.mockRejectedValue(
        new Error("Service unavailable"),
      );

      const { error } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial-123", "👍"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Service unavailable");
    });
  });
});
