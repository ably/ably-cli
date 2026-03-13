import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../helpers/mock-ably-chat.js";
import { createMockPaginatedResult } from "../../../helpers/mock-ably-rest.js";
import { captureJsonLogs } from "../../../helpers/ndjson.js";

describe("rooms messages commands", function () {
  beforeEach(function () {
    getMockAblyChat();
  });

  describe("functionality", function () {
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
      expect(stdout).toContain("Message sent to room test-room");
    });

    it("should emit JSON envelope with type result for --json single send", async function () {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.send.mockResolvedValue({
        serial: "msg-serial",
        createdAt: Date.now(),
      });

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:send", "test-room", "HelloJSON", "--json"],
          import.meta.url,
        );
      });
      const results = records.filter(
        (r) => r.type === "result" && r.room === "test-room",
      );
      expect(results.length).toBeGreaterThan(0);
      const record = results[0];
      expect(record).toHaveProperty("type", "result");
      expect(record).toHaveProperty("command", "rooms:messages:send");
      expect(record).toHaveProperty("success", true);
      expect(record).toHaveProperty("room", "test-room");
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
      expect(stdout).toContain("3/3 messages sent to room test-room");
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

      it("should emit JSON envelope with type event for --json subscribe", async function () {
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

    describe("rooms messages history", function () {
      it("should retrieve room message history", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        // Add history mock to messages
        room.messages.history = vi.fn().mockResolvedValue(
          createMockPaginatedResult([
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
          ]),
        );

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

        room.messages.history = vi
          .fn()
          .mockResolvedValue(createMockPaginatedResult([]));

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

      it("should respect --start and --end flags with ISO 8601", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.history = vi
          .fn()
          .mockResolvedValue(createMockPaginatedResult([]));

        const start = "2025-01-01T00:00:00Z";
        const end = "2025-01-02T00:00:00Z";

        await runCommand(
          [
            "rooms:messages:history",
            "test-room",
            "--start",
            start,
            "--end",
            end,
          ],
          import.meta.url,
        );

        expect(room.messages.history).toHaveBeenCalledWith(
          expect.objectContaining({
            start: new Date(start).getTime(),
            end: new Date(end).getTime(),
          }),
        );
      });

      it("should accept Unix ms string for --start", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.history = vi
          .fn()
          .mockResolvedValue(createMockPaginatedResult([]));

        await runCommand(
          ["rooms:messages:history", "test-room", "--start", "1700000000000"],
          import.meta.url,
        );

        expect(room.messages.history).toHaveBeenCalledWith(
          expect.objectContaining({
            start: 1700000000000,
          }),
        );
      });

      it("should accept relative time for --start", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.history = vi
          .fn()
          .mockResolvedValue(createMockPaginatedResult([]));

        await runCommand(
          ["rooms:messages:history", "test-room", "--start", "1h"],
          import.meta.url,
        );

        const callArgs = room.messages.history.mock.calls[0][0];
        const oneHourAgo = Date.now() - 3_600_000;
        expect(callArgs.start).toBeGreaterThan(oneHourAgo - 5000);
        expect(callArgs.start).toBeLessThanOrEqual(oneHourAgo + 5000);
      });

      it("should emit JSON envelope with type result for --json history", async function () {
        const chatMock = getMockAblyChat();
        const room = chatMock.rooms._getRoom("test-room");

        room.messages.history = vi.fn().mockResolvedValue(
          createMockPaginatedResult([
            {
              text: "History msg",
              clientId: "client1",
              timestamp: new Date(Date.now() - 5000),
              serial: "msg-h1",
            },
          ]),
        );

        const records = await captureJsonLogs(async () => {
          await runCommand(
            ["rooms:messages:history", "test-room", "--json"],
            import.meta.url,
          );
        });
        const results = records.filter(
          (r) => r.type === "result" && r.room === "test-room",
        );
        expect(results.length).toBeGreaterThan(0);
        const record = results[0];
        expect(record).toHaveProperty("type", "result");
        expect(record).toHaveProperty("command", "rooms:messages:history");
        expect(record).toHaveProperty("success", true);
        expect(record).toHaveProperty("room", "test-room");
        expect(record).toHaveProperty("messages");
      });
    });
  });

  describe("error handling", function () {
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
