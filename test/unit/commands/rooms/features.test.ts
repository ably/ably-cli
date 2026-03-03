import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../helpers/mock-ably-chat.js";

describe("rooms feature commands", function () {
  beforeEach(function () {
    getMockAblyChat();
  });

  describe("rooms occupancy get", function () {
    it("should get room occupancy metrics", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.occupancy.get.mockResolvedValue({
        connections: 5,
        presenceMembers: 4,
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.occupancy.get).toHaveBeenCalled();
      expect(stdout).toContain("5");
    });
  });

  describe("rooms occupancy subscribe", function () {
    it("should subscribe to room occupancy updates", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.occupancy.subscribe.mockImplementation(
        (_callback: (event: unknown) => void) => {
          return { unsubscribe: vi.fn() };
        },
      );

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.occupancy.subscribe).toHaveBeenCalled();
      expect(stdout).toContain("Subscribing");
    });

    it("should display occupancy updates when received", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.occupancy.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          // Simulate receiving an occupancy update after room is attached
          setTimeout(() => {
            callback({
              connections: 6,
              presenceMembers: 4,
            });
          }, 100);
          return { unsubscribe: vi.fn() };
        },
      );

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      // Check for either the number or part of the occupancy output
      expect(stdout).toMatch(/6|connections/i);
    });
  });

  describe("rooms presence enter", function () {
    it("should enter room presence successfully", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.presence.enter.mockImplementation(async () => {});

      // Emit SIGINT to stop the command

      const { stdout } = await runCommand(
        ["rooms:presence:enter", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.presence.enter).toHaveBeenCalled();
      expect(stdout).toContain("Entered");
    });

    it("should handle presence data", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.presence.enter.mockImplementation(async () => {});

      await runCommand(
        [
          "rooms:presence:enter",
          "test-room",
          "--data",
          '{"status":"online","name":"TestUser"}',
        ],
        import.meta.url,
      );

      expect(room.presence.enter).toHaveBeenCalledWith({
        status: "online",
        name: "TestUser",
      });
    });
  });

  describe("rooms reactions send", function () {
    it("should send a reaction successfully", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.reactions.send.mockImplementation(async () => {});

      const { stdout } = await runCommand(
        ["rooms:reactions:send", "test-room", "👍"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.reactions.send).toHaveBeenCalledWith({
        name: "👍",
        metadata: {},
      });
      expect(stdout).toContain("Sent reaction");
    });

    it("should handle metadata in reactions", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.reactions.send.mockImplementation(async () => {});

      await runCommand(
        [
          "rooms:reactions:send",
          "test-room",
          "🎉",
          "--metadata",
          '{"intensity":"high"}',
        ],
        import.meta.url,
      );

      expect(room.reactions.send).toHaveBeenCalledWith({
        name: "🎉",
        metadata: { intensity: "high" },
      });
    });
  });

  describe("rooms typing keystroke", function () {
    it("should start typing indicator", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.typing.keystroke.mockImplementation(async () => {});

      // Emit SIGINT to stop the command

      const { stdout } = await runCommand(
        ["rooms:typing:keystroke", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.typing.keystroke).toHaveBeenCalled();
      expect(stdout).toContain("typing");
    });
  });
});
