import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { registerMock } from "../test-utils.js";
import { RoomStatus } from "@ably/chat";

describe("Rooms messages send ordering integration tests", function () {
  let originalEnv: NodeJS.ProcessEnv;
  let sentMessages: Array<{ text: string; timestamp: number }>;

  beforeEach(function () {
    // Store original env vars
    originalEnv = { ...process.env };

    // Set environment variables for this test file
    process.env.ABLY_CLI_TEST_MODE = "true";
    process.env.ABLY_API_KEY = "test.key:secret";

    // Reset sent messages for each test
    sentMessages = [];

    // Create a function that tracks sent messages with timestamps
    const sendFunction = async (message: any) => {
      sentMessages.push({
        text: message.text,
        timestamp: Date.now(),
      });
      // Simulate some network latency
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      return;
    };

    // Create mock room
    const createMockRoom = (room: string) => ({
      id: room,
      attach: async () => {},
      detach: async () => {},

      onStatusChange: (callback: (change: any) => void) => {
        setTimeout(() => {
          callback({
            current: RoomStatus.Attached,
          });
        }, 100);
      },

      messages: {
        send: sendFunction,
      },
    });

    const mockRealtimeClient = {
      connection: {
        once: (event: string, callback: () => void) => {
          if (event === "connected") {
            setTimeout(callback, 0);
          }
        },
        on: (callback: (stateChange: any) => void) => {
          setTimeout(() => {
            callback({ current: "connected", reason: null });
          }, 10);
        },
        state: "connected",
        id: "test-connection-id",
      },
      close: () => {},
    };

    const mockChatClient = {
      rooms: {
        get: (room: string) => createMockRoom(room),
        release: async (_: string) => {},
      },
      connection: {
        onStatusChange: (_: (change: any) => void) => {},
      },
      realtime: mockRealtimeClient,
    };

    // Register the chat and realtime mocks using the test-utils system
    registerMock("ablyChatMock", mockChatClient);
    registerMock("ablyRealtimeMock", mockRealtimeClient);
  });

  afterEach(function () {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("Message delay and ordering", function () {
    it("should have 40ms default delay between messages", async function () {
      const startTime = Date.now();
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          "test-room",
          '"Message {{.Count}}"',
          "--count",
          "3",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Sending 3 messages with 40ms delay");
      expect(stdout).toContain("3/3 messages sent successfully");

      // Check that messages were sent with appropriate delays
      expect(sentMessages).toHaveLength(3);

      // Check message order
      expect(sentMessages[0].text).toBe("Message 1");
      expect(sentMessages[1].text).toBe("Message 2");
      expect(sentMessages[2].text).toBe("Message 3");

      // Check timing - should take at least 80ms (2 delays of 40ms)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(80);
    });

    it("should respect custom delay value", async function () {
      const startTime = Date.now();
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          "test-room",
          '"Message {{.Count}}"',
          "--count",
          "3",
          "--delay",
          "100",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Sending 3 messages with 100ms delay");
      expect(stdout).toContain("3/3 messages sent successfully");

      // Check timing - should take at least 200ms (2 delays of 100ms)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(200);
    });

    it("should enforce minimum 40ms delay even if lower value specified", async function () {
      const startTime = Date.now();
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          "test-room",
          '"Message {{.Count}}"',
          "--count",
          "3",
          "--delay",
          "10",
        ],
        import.meta.url,
      );

      // Should use 40ms instead of 10ms
      expect(stdout).toContain("Sending 3 messages with 40ms delay");
      expect(stdout).toContain("3/3 messages sent successfully");

      // Check timing - should take at least 80ms (2 delays of 40ms)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(80);
    });

    it("should send messages in sequential order with delay", async function () {
      await runCommand(
        [
          "rooms",
          "messages",
          "send",
          "test-room",
          '"Message {{.Count}}"',
          "--count",
          "5",
        ],
        import.meta.url,
      );

      expect(sentMessages).toHaveLength(5);

      // Verify messages are in correct order
      for (let i = 0; i < 5; i++) {
        expect(sentMessages[i].text).toBe(`Message ${i + 1}`);
      }

      // Verify timestamps are sequential (each should be at least 40ms apart)
      for (let i = 1; i < sentMessages.length; i++) {
        const timeDiff =
          sentMessages[i].timestamp - sentMessages[i - 1].timestamp;
        expect(timeDiff).toBeGreaterThanOrEqual(35); // Allow some margin for timer precision
      }
    });
  });

  describe("Single message sending", function () {
    it("should send single message without delay", async function () {
      const { stdout } = await runCommand(
        ["rooms", "messages", "send", "test-room", '"Single message"'],
        import.meta.url,
      );

      expect(stdout).toContain("Message sent successfully");
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].text).toBe("Single message");
    });
  });

  describe("Error handling with multiple messages", function () {
    it("should continue sending remaining messages on error", async function () {
      // Override the send function to make the 3rd message fail
      let callCount = 0;
      const failingSendFunction = async (message: any) => {
        callCount++;
        if (callCount === 3) {
          throw new Error("Network error");
        }
        sentMessages.push({
          text: message.text,
          timestamp: Date.now(),
        });
        return;
      };

      // Create mock room with failing send function
      const createMockRoomWithError = (room: string) => ({
        id: room,
        attach: async () => {},
        detach: async () => {},

        onStatusChange: (callback: (change: any) => void) => {
          setTimeout(() => {
            callback({
              current: RoomStatus.Attached,
            });
          }, 100);
        },

        messages: {
          send: failingSendFunction,
        },
      });

      const mockRealtimeClient = {
        connection: {
          once: (event: string, callback: () => void) => {
            if (event === "connected") {
              setTimeout(callback, 0);
            }
          },
          on: (callback: (stateChange: any) => void) => {
            setTimeout(() => {
              callback({ current: "connected", reason: null });
            }, 10);
          },
          state: "connected",
          id: "test-connection-id",
        },
        close: () => {},
      };

      const mockChatClientWithError = {
        rooms: {
          get: (room: string) => createMockRoomWithError(room),
          release: async (_: string) => {},
        },
        connection: {
          onStatusChange: (_: (change: any) => void) => {},
        },
        realtime: mockRealtimeClient,
      };

      // Re-register mocks with error-inducing client
      registerMock("ablyChatMock", mockChatClientWithError);
      registerMock("ablyRealtimeMock", mockRealtimeClient);

      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          "test-room",
          '"Message {{.Count}}"',
          "--count",
          "5",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("4/5 messages sent successfully (1 errors)");
      expect(sentMessages).toHaveLength(4);
    });
  });
});
