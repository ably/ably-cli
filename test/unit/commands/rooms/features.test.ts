import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../helpers/mock-ably-chat.js";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("rooms feature commands", function () {
  beforeEach(function () {
    getMockAblyChat();
  });

  describe("functionality", function () {
    it("should get room occupancy metrics", async function () {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [
          {
            status: {
              occupancy: {
                metrics: {
                  connections: 5,
                  presenceConnections: 2,
                  presenceMembers: 4,
                  presenceSubscribers: 1,
                  publishers: 3,
                  subscribers: 6,
                },
              },
            },
          },
        ],
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalled();
      expect(stdout).toContain("5");
    });
  });

  describe("rooms occupancy subscribe", function () {
    it("should subscribe to room occupancy updates", async function () {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-room::$chat");

      mock.connection.once.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === "connected") callback();
        },
      );
      channel.once.mockImplementation((event: string, callback: () => void) => {
        if (event === "attached") {
          channel.state = "attached";
          callback();
        }
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(channel.subscribe).toHaveBeenCalledWith(
        "[meta]occupancy",
        expect.any(Function),
      );
      expect(stdout).toContain("Subscribed to occupancy");
    });

    it("should display subscribing message", async function () {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-room::$chat");

      mock.connection.once.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === "connected") callback();
        },
      );
      channel.once.mockImplementation((event: string, callback: () => void) => {
        if (event === "attached") {
          channel.state = "attached";
          callback();
        }
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to occupancy events on room");
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

  describe("error handling", () => {
    it("should handle occupancy get failure", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle presence enter failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.attach.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["rooms:presence:enter", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle reactions send failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.reactions.send.mockRejectedValue(new Error("Send failed"));

      const { error } = await runCommand(
        ["rooms:reactions:send", "test-room", "thumbsup"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
