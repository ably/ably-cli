import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:messages:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:messages:subscribe", import.meta.url);
  standardArgValidationTests("rooms:messages:subscribe", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:messages:subscribe", import.meta.url, [
    "--json",
    "--duration",
    "--show-metadata",
    "--sequence-numbers",
  ]);

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

    it("should display received messages with action and serial", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          setTimeout(() => {
            callback({
              type: "message.created",
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
      expect(stdout).toContain("message.created");
      expect(stdout).toContain("Serial");
      expect(stdout).toContain("msg-123");
    });

    it("should display metadata when --show-metadata is passed", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          setTimeout(() => {
            callback({
              type: "message.created",
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
        (r) =>
          r.type === "event" &&
          (r.message as Record<string, unknown>)?.room === "test-room",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "rooms:messages:subscribe");
      const msg = record.message as Record<string, unknown>;
      expect(msg).toHaveProperty("room", "test-room");
      expect(msg).toHaveProperty("eventType", "message.created");
      expect(msg).toHaveProperty("serial", "msg-json");
      expect(msg).toHaveProperty("action", "message.created");
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
      expect(error?.message).toContain("Failed to get room");
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
      expect(error?.message).toContain("Attach failed");
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
