import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:reactions:send command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("sending reactions", () => {
    it("should send reaction emoji", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const { stdout } = await runCommand(
        ["rooms:reactions:send", "test-room", "thumbsup"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.reactions.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: "thumbsup" }),
      );
      expect(stdout).toContain("Sent reaction");
      expect(stdout).toContain("thumbsup");
    });

    it("should parse and forward --metadata JSON", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      await runCommand(
        [
          "rooms:reactions:send",
          "test-room",
          "heart",
          "--metadata",
          '{"color":"red"}',
        ],
        import.meta.url,
      );

      expect(room.reactions.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "heart",
          metadata: { color: "red" },
        }),
      );
    });

    it("should error on invalid --metadata", async () => {
      const { error } = await runCommand(
        [
          "rooms:reactions:send",
          "test-room",
          "heart",
          "--metadata",
          "not-json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Invalid metadata JSON");
    });

    it("should output JSON on success", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const { stdout } = await runCommand(
        ["rooms:reactions:send", "test-room", "fire", "--json"],
        import.meta.url,
      );

      expect(room.reactions.send).toHaveBeenCalled();
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("emoji", "fire");
      expect(result).toHaveProperty("room", "test-room");
    });

    it("should output JSON error on send failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.reactions.send.mockRejectedValue(new Error("Send failed"));

      const { stdout } = await runCommand(
        ["rooms:reactions:send", "test-room", "fire", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Send failed");
    });
  });
});
