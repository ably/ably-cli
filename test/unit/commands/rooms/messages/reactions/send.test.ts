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

      const { stdout } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial-123", "👍"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.reactions.send).toHaveBeenCalledWith(
        "msg-serial-123",
        {
          name: "👍",
        },
      );
      expect(stdout).toContain("Sent reaction");
      expect(stdout).toContain("👍");
      expect(stdout).toContain("msg-serial-123");
      expect(stdout).toContain("test-room");
    });

    it("should send a reaction with type flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.send.mockImplementation(async () => {});

      const { stdout } = await runCommand(
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
      expect(stdout).toContain("Sent reaction");
      expect(stdout).toContain("❤️");
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

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("room", "test-room");
      expect(result).toHaveProperty("messageSerial", "msg-serial-123");
      expect(result).toHaveProperty("reaction", "👍");
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
