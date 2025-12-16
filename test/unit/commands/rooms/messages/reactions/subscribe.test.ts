import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { RoomStatus } from "@ably/chat";

describe("rooms:messages:reactions:subscribe command", () => {
  beforeEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      delete globalThis.__TEST_MOCKS__.ablyChatMock;
    }
  });

  afterEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      delete globalThis.__TEST_MOCKS__.ablyChatMock;
    }
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to message reactions and display them", async () => {
      let reactionsCallback: ((event: any) => void) | null = null;
      let statusUnsubscribe: (() => void) | null = null;
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockReactionsSubscribe = vi.fn((callback) => {
        reactionsCallback = callback;
        return () => {}; // unsubscribe function
      });

      const mockOnStatusChange = vi.fn((callback) => {
        // Immediately call with Attached status
        callback({ current: RoomStatus.Attached });
        statusUnsubscribe = () => {};
        return statusUnsubscribe;
      });

      const mockRoom = {
        messages: {
          reactions: {
            subscribe: mockReactionsSubscribe,
          },
        },
        onStatusChange: mockOnStatusChange,
        attach: vi.fn(),
      };

      const mockRooms = {
        get: vi.fn().mockResolvedValue(mockRoom),
      };

      const mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyChatMock: {
          rooms: mockRooms,
          realtime: mockRealtimeClient,
        } as any,
        ablyRealtimeMock: mockRealtimeClient as any,
      };

      const commandPromise = runCommand(
        ["rooms:messages:reactions:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockReactionsSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a message reaction summary event
      if (reactionsCallback) {
        reactionsCallback({
          messageSerial: "msg-123",
          reactions: {
            unique: {
              like: { total: 1, clientIds: ["user1"] },
            },
            distinct: {
              like: { total: 1, clientIds: ["user1"] },
            },
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(mockRooms.get).toHaveBeenCalled();
      expect(mockReactionsSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Verify output contains reaction data
      const output = capturedLogs.join("\n");
      expect(output).toContain("msg-123");
      expect(output).toContain("like");
    });

    it("should output JSON format when --json flag is used", async () => {
      let reactionsCallback: ((event: any) => void) | null = null;
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockReactionsSubscribe = vi.fn((callback) => {
        reactionsCallback = callback;
        return () => {};
      });

      const mockOnStatusChange = vi.fn((callback) => {
        callback({ current: RoomStatus.Attached });
        return () => {};
      });

      const mockRoom = {
        messages: {
          reactions: {
            subscribe: mockReactionsSubscribe,
          },
        },
        onStatusChange: mockOnStatusChange,
        attach: vi.fn(),
      };

      const mockRooms = {
        get: vi.fn().mockResolvedValue(mockRoom),
      };

      const mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyChatMock: {
          rooms: mockRooms,
          realtime: mockRealtimeClient,
        } as any,
        ablyRealtimeMock: mockRealtimeClient as any,
      };

      const commandPromise = runCommand(
        ["rooms:messages:reactions:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockReactionsSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate message reaction summary event
      if (reactionsCallback) {
        reactionsCallback({
          messageSerial: "msg-456",
          reactions: {
            unique: {
              heart: { total: 2, clientIds: ["user1", "user2"] },
            },
            distinct: {
              heart: { total: 2, clientIds: ["user1", "user2"] },
            },
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(mockReactionsSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Find the JSON output with reaction summary data
      const reactionOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.summary && parsed.room;
        } catch {
          return false;
        }
      });

      // Verify that reaction summary was actually output in JSON format
      expect(reactionOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(reactionOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("room", "test-room");
      expect(parsed.summary).toHaveProperty("unique");
      expect(parsed.summary.unique).toHaveProperty("heart");
    });
  });
});
