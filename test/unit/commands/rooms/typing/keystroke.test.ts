import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:typing:keystroke command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:typing:keystroke", import.meta.url);
  standardArgValidationTests("rooms:typing:keystroke", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:typing:keystroke", import.meta.url, [
    "--json",
    "--auto-type",
  ]);

  describe("functionality", () => {
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
        ["rooms:typing:keystroke", "test-room", "--auto-type"],
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
      expect(error?.message).toContain("Connection failed");
    });

    it("should output JSON with typing domain key on success", async () => {
      const chatMock = getMockAblyChat();
      chatMock.rooms._getRoom("test-room");

      const { stdout } = await runCommand(
        ["rooms:typing:keystroke", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("typing");
      expect(result.typing).toHaveProperty("room", "test-room");
      expect(result.typing).toHaveProperty("isTyping", true);
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
      expect(result.error.message).toContain("Connection failed");
    });
  });

  describe("error handling", () => {
    it("should handle room attach failure gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.attach.mockRejectedValue(new Error("Room unavailable"));

      const { error } = await runCommand(
        ["rooms:typing:keystroke", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Room unavailable");
    });

    it("should handle keystroke failure gracefully without a stack trace", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.typing.keystroke.mockRejectedValue(
        new Error("Channel denied access based on given capability"),
      );

      const { error, stderr } = await runCommand(
        ["rooms:typing:keystroke", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
      // Must not dump a raw stack trace — the error should be caught cleanly
      expect(stderr).not.toContain("at ");
      expect(stderr).not.toContain("CLIError");
    });

    it("should output JSON error on keystroke failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.typing.keystroke.mockRejectedValue(
        new Error("Channel denied access based on given capability"),
      );

      const { stdout, stderr } = await runCommand(
        ["rooms:typing:keystroke", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("Channel denied access");
      // Must not dump a raw stack trace — the error should be caught cleanly
      expect(stderr).not.toContain("at ");
      expect(stderr).not.toContain("CLIError");
    });
  });
});
