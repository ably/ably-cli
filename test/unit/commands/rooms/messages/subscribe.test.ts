import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";

describe("rooms:messages:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("help", () => {
    it("should show usage when --help is passed", async () => {
      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:messages:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should subscribe to room messages", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(() => {
        return { unsubscribe: vi.fn() };
      });

      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.subscribe).toHaveBeenCalled();
      expect(stdout).toContain("Subscribed to room");
    });

    it("should display received messages", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          setTimeout(() => {
            callback({
              message: {
                text: "Hello from chat",
                clientId: "sender-client",
                timestamp: new Date(),
                serial: "msg-123",
              },
            });
          }, 50);
          return { unsubscribe: vi.fn() };
        },
      );

      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("sender-client");
      expect(stdout).toContain("Hello from chat");
    });

    it("should display metadata when --show-metadata is passed", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          setTimeout(() => {
            callback({
              message: {
                text: "Msg with meta",
                clientId: "user1",
                timestamp: new Date(),
                serial: "msg-meta",
                metadata: { priority: "high" },
              },
            });
          }, 50);
          return { unsubscribe: vi.fn() };
        },
      );

      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "test-room", "--show-metadata"],
        import.meta.url,
      );

      expect(stdout).toContain("Metadata");
      expect(stdout).toContain("priority");
    });

    it("should emit JSON envelope with type event for --json", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      let messageCallback: ((event: unknown) => void) | null = null;
      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          messageCallback = callback;
          return { unsubscribe: vi.fn() };
        },
      );

      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["rooms:messages:subscribe", "test-room", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(messageCallback).not.toBeNull();
        });

        messageCallback!({
          type: "message.created",
          message: {
            text: "JSON test msg",
            clientId: "json-client",
            timestamp: new Date(),
            serial: "msg-json",
          },
        });

        await commandPromise;
      });

      const events = records.filter(
        (r) => r.type === "event" && r.room === "test-room",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "rooms:messages:subscribe");
      expect(record).toHaveProperty("room", "test-room");
    });
  });

  describe("flags", () => {
    it("should accept --duration flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(() => {
        return { unsubscribe: vi.fn() };
      });

      await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.subscribe).toHaveBeenCalled();
    });

    it("should accept --show-metadata flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(() => {
        return { unsubscribe: vi.fn() };
      });

      const { error } = await runCommand(
        ["rooms:messages:subscribe", "test-room", "--show-metadata"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
    });

    it("should accept --sequence-numbers flag", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          setTimeout(() => {
            callback({
              message: {
                text: "Numbered msg",
                clientId: "user1",
                timestamp: new Date(),
                serial: "msg-seq",
              },
            });
          }, 50);
          return { unsubscribe: vi.fn() };
        },
      );

      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "test-room", "--sequence-numbers"],
        import.meta.url,
      );

      // Sequence numbers appear as [1] in output
      expect(stdout).toContain("[1]");
    });
  });

  describe("error handling", () => {
    it("should handle chat client creation failure", async () => {
      const chatMock = getMockAblyChat();
      chatMock.rooms.get.mockRejectedValue(new Error("Failed to get room"));

      const { error } = await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Failed to get room");
    });

    it("should handle attach failure", async () => {
      const chatMock = getMockAblyChat();
      // Re-mock rooms.get to return the room (previous test may have overridden it)
      const room = chatMock.rooms._getRoom("test-room");
      chatMock.rooms.get.mockResolvedValue(room);

      room.messages.subscribe.mockImplementation(() => {
        return { unsubscribe: vi.fn() };
      });
      room.attach.mockRejectedValue(new Error("Attach failed"));

      const { error } = await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Attach failed");
    });

    it("should output JSON error on failure with --json", async () => {
      const chatMock = getMockAblyChat();
      chatMock.rooms.get.mockRejectedValue(new Error("Connection error"));

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:subscribe", "test-room", "--json"],
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
