import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../helpers/mock-ably-chat.js";

describe("rooms messages commands", function () {
  beforeEach(function () {
    getMockAblyChat();
  });

  describe("rooms messages send", function () {
    it("should send a single message successfully", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      const { stdout } = await runCommand(
        ["rooms:messages:send", "test-room", "HelloWorld"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.send).toHaveBeenCalledWith({
        text: "HelloWorld",
      });
      expect(stdout).toContain("Message sent successfully");
    });

    it("should send multiple messages with interpolation", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const sentTexts: string[] = [];
      room.messages.send.mockImplementation(
        async (params: { text: string }) => {
          sentTexts.push(params.text);
          return { serial: "msg-serial", createdAt: Date.now() };
        },
      );

      const { stdout } = await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "Message{{.Count}}",
          "--count",
          "3",
          "--delay",
          "40",
        ],
        import.meta.url,
      );

      expect(room.messages.send).toHaveBeenCalledTimes(3);
      expect(sentTexts).toContain("Message1");
      expect(sentTexts).toContain("Message2");
      expect(sentTexts).toContain("Message3");
      expect(stdout).toContain("3/3 messages sent successfully");
    });

    it("should handle metadata in messages", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "ImportantMessage",
          "--metadata",
          '{"isImportant":true}',
        ],
        import.meta.url,
      );

      expect(room.messages.send).toHaveBeenCalledWith({
        text: "ImportantMessage",
        metadata: { isImportant: true },
      });
    });

    it("should handle invalid metadata JSON", async function () {
      const { error } = await runCommand(
        [
          "rooms:messages:send",
          "test-room",
          "TestMessage",
          "--metadata",
          "invalid-json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid metadata JSON/i);
    });

    describe("message delay and ordering", function () {
      it("should send messages with delays between them", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.send.mockResolvedValue({
          serial: "msg-serial",
          createdAt: Date.now(),
        });

        const startTime = Date.now();
        await runCommand(
          [
            "rooms:messages:send",
            "test-room",
            "Message{{.Count}}",
            "--count",
            "3",
            "--delay",
            "50",
          ],
          import.meta.url,
        );
        const totalTime = Date.now() - startTime;

        expect(room.messages.send).toHaveBeenCalledTimes(3);
        // Should take at least 100ms (2 delays of 50ms between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(100);
      });

      it("should respect custom delay value", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.send.mockResolvedValue({
          serial: "msg-serial",
          createdAt: Date.now(),
        });

        const startTime = Date.now();
        await runCommand(
          [
            "rooms:messages:send",
            "test-room",
            "Message{{.Count}}",
            "--count",
            "3",
            "--delay",
            "100",
          ],
          import.meta.url,
        );
        const totalTime = Date.now() - startTime;

        expect(room.messages.send).toHaveBeenCalledTimes(3);
        // Should take at least 200ms (2 delays of 100ms between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(200);
      });

      it("should enforce minimum 40ms delay even if lower value specified", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.send.mockResolvedValue({
          serial: "msg-serial",
          createdAt: Date.now(),
        });

        const startTime = Date.now();
        await runCommand(
          [
            "rooms:messages:send",
            "test-room",
            "Message{{.Count}}",
            "--count",
            "3",
            "--delay",
            "10", // Below minimum
          ],
          import.meta.url,
        );
        const totalTime = Date.now() - startTime;

        expect(room.messages.send).toHaveBeenCalledTimes(3);
        // Should take at least 80ms (minimum 40ms delay enforced between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(80);
      });

      it("should send messages in sequential order", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        const sentTexts: string[] = [];
        room.messages.send.mockImplementation(
          async (params: { text: string }) => {
            sentTexts.push(params.text);
            return { serial: "msg-serial", createdAt: Date.now() };
          },
        );

        await runCommand(
          [
            "rooms:messages:send",
            "test-room",
            "Message{{.Count}}",
            "--count",
            "5",
            "--delay",
            "40",
          ],
          import.meta.url,
        );

        expect(sentTexts).toEqual([
          "Message1",
          "Message2",
          "Message3",
          "Message4",
          "Message5",
        ]);
      });
    });

    describe("error handling with multiple messages", function () {
      it("should continue sending remaining messages on error", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        let callCount = 0;
        const sentTexts: string[] = [];

        room.messages.send.mockImplementation(
          async (params: { text: string }) => {
            callCount++;
            if (callCount === 3) {
              throw new Error("Network error");
            }
            sentTexts.push(params.text);
            return { serial: "msg-serial", createdAt: Date.now() };
          },
        );

        await runCommand(
          [
            "rooms:messages:send",
            "test-room",
            "Message{{.Count}}",
            "--count",
            "5",
            "--delay",
            "40",
          ],
          import.meta.url,
        );

        // Should have attempted all 5, but only 4 succeeded
        expect(room.messages.send).toHaveBeenCalledTimes(5);
        expect(sentTexts).toHaveLength(4);
      });
    });
  });

  describe("rooms messages subscribe", function () {
    it("should subscribe to room messages", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      // Mock subscribe
      room.messages.subscribe.mockImplementation(
        (_callback: (event: unknown) => void) => {
          return { unsubscribe: vi.fn() };
        },
      );

      // Emit SIGINT after a delay to stop the command

      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.subscribe).toHaveBeenCalled();
      expect(stdout).toContain("Subscribed to room");
    });

    it("should display received messages", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      // Mock subscribe to capture callback and call it with a message
      room.messages.subscribe.mockImplementation(
        (callback: (event: unknown) => void) => {
          // Simulate receiving a message shortly after subscription
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

      // Stop the command after message is received

      const { stdout } = await runCommand(
        ["rooms:messages:subscribe", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("sender-client");
      expect(stdout).toContain("Hello from chat");
    });
  });

  describe("rooms messages history", function () {
    it("should retrieve room message history", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      // Add history mock to messages
      room.messages.history = vi.fn().mockResolvedValue({
        items: [
          {
            text: "Historical message 1",
            clientId: "client1",
            timestamp: new Date(Date.now() - 10000),
            serial: "msg-1",
          },
          {
            text: "Historical message 2",
            clientId: "client2",
            timestamp: new Date(Date.now() - 5000),
            serial: "msg-2",
          },
        ],
      });

      const { stdout } = await runCommand(
        ["rooms:messages:history", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.history).toHaveBeenCalled();
      expect(stdout).toContain("Historical message 1");
      expect(stdout).toContain("Historical message 2");
    });

    it("should handle query options for history", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      await runCommand(
        [
          "rooms:messages:history",
          "test-room",
          "--limit",
          "25",
          "--order",
          "oldestFirst",
        ],
        import.meta.url,
      );

      // Command uses OrderBy enum from @ably/chat
      expect(room.messages.history).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
        }),
      );
    });
  });
});
