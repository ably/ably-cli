import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:typing:keystroke command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("typing keystroke", () => {
    it("should send keystroke and show success", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const { stdout } = await runCommand(
        ["rooms:typing:keystroke", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.typing.keystroke).toHaveBeenCalled();
      expect(stdout).toContain("Started typing");
    });

    it("should handle --auto-type flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const { stdout } = await runCommand(
        [
          "rooms:typing:keystroke",
          "test-room",
          "--auto-type",
          "--duration",
          "0",
        ],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.typing.keystroke).toHaveBeenCalled();
      expect(stdout).toContain("automatically");
    });

    it("should handle keystroke failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.attach.mockImplementation(async () => {
        throw new Error("Connection failed");
      });

      const { error } = await runCommand(
        ["rooms:typing:keystroke", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Connection failed");
    });

    it("should output JSON error on failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.attach.mockImplementation(async () => {
        throw new Error("Connection failed");
      });

      const { stdout } = await runCommand(
        ["rooms:typing:keystroke", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Connection failed");
    });
  });
});
