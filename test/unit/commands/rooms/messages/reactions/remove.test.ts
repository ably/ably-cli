import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../../helpers/mock-ably-chat.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../../helpers/standard-tests.js";

describe("rooms:messages:reactions:remove command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:messages:reactions:remove", import.meta.url);
  standardArgValidationTests(
    "rooms:messages:reactions:remove",
    import.meta.url,
    { requiredArgs: ["test-room", "msg-serial", "thumbsup"] },
  );
  standardFlagTests("rooms:messages:reactions:remove", import.meta.url, [
    "--json",
    "--type",
  ]);

  describe("functionality", () => {
    it("should remove a reaction from a message", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      // Configure message reactions delete mock
      room.messages.reactions.delete.mockImplementation(async () => {});

      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
        ],
        import.meta.url,
      );

      expect(room.attach).not.toHaveBeenCalled();
      expect(room.messages.reactions.delete).toHaveBeenCalledWith(
        "msg-serial-123",
        {
          name: "👍",
        },
      );
      expect(stdout).toContain("Removed reaction");
      expect(stdout).toContain("👍");
      expect(stdout).toContain("msg-serial-123");
      expect(stdout).toContain("test-room");
    });

    it("should remove a reaction with type flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.delete.mockImplementation(async () => {});

      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "❤️",
          "--type",
          "unique",
        ],
        import.meta.url,
      );

      expect(room.messages.reactions.delete).toHaveBeenCalledWith(
        "msg-serial-123",
        {
          name: "❤️",
          type: expect.any(String),
        },
      );
      expect(stdout).toContain("Removed reaction");
      expect(stdout).toContain("❤️");
    });

    it("should output JSON when --json flag is used", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.delete.mockImplementation(async () => {});

      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("reaction");
      expect(result.reaction).toHaveProperty("room", "test-room");
      expect(result.reaction).toHaveProperty("messageSerial", "msg-serial-123");
      expect(result.reaction).toHaveProperty("type", "👍");
    });

    it("should handle reaction removal failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.reactions.delete.mockRejectedValue(
        new Error("Failed to remove reaction"),
      );

      const { error } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to remove reaction");
    });
  });

  describe("error handling", () => {
    it("should handle reaction deletion failure gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.messages.reactions.delete.mockRejectedValue(
        new Error("Service unavailable"),
      );

      const { error } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Service unavailable");
    });
  });
});
