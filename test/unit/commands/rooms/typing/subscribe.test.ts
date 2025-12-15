import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { RoomStatus } from "@ably/chat";

describe("rooms:typing:subscribe command", () => {
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
        ["rooms:typing:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:typing:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to typing events and display them", async () => {
      let typingCallback: ((event: any) => void) | null = null;
      let statusCallback: ((change: any) => void) | null = null;

      const mockTypingSubscribe = vi.fn((callback) => {
        typingCallback = callback;
      });

      const mockOnStatusChange = vi.fn((callback) => {
        statusCallback = callback;
      });

      const mockRoom = {
        typing: {
          subscribe: mockTypingSubscribe,
        },
        onStatusChange: mockOnStatusChange,
        attach: vi.fn().mockImplementation(async () => {
          // Simulate room attaching
          if (statusCallback) {
            statusCallback({ current: RoomStatus.Attached });
          }
        }),
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

      // Run command in background
      const commandPromise = runCommand(
        ["rooms:typing:subscribe", "test-room"],
        import.meta.url,
      );

      // Wait for subscription to be set up
      await vi.waitFor(
        () => {
          expect(mockTypingSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a typing event
      if (typingCallback) {
        typingCallback({
          currentlyTyping: new Set(["user1", "user2"]),
        });
      }

      // Give time for output to be generated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate Ctrl+C to stop the command
      process.emit("SIGINT", "SIGINT");

      const result = await commandPromise;

      // Verify subscription was set up
      expect(mockRooms.get).toHaveBeenCalledWith("test-room");
      expect(mockTypingSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Verify output contains typing notification
      expect(result.stdout).toContain("user1");
      expect(result.stdout).toContain("user2");
      expect(result.stdout).toContain("typing");
    });

    it("should output JSON format when --json flag is used", async () => {
      let typingCallback: ((event: any) => void) | null = null;
      let statusCallback: ((change: any) => void) | null = null;
      const capturedLogs: string[] = [];

      // Spy on console.log to capture output
      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockTypingSubscribe = vi.fn((callback) => {
        typingCallback = callback;
      });

      const mockOnStatusChange = vi.fn((callback) => {
        statusCallback = callback;
      });

      const mockRoom = {
        typing: {
          subscribe: mockTypingSubscribe,
        },
        onStatusChange: mockOnStatusChange,
        attach: vi.fn().mockImplementation(async () => {
          if (statusCallback) {
            statusCallback({ current: RoomStatus.Attached });
          }
        }),
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
        ["rooms:typing:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockTypingSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate typing event
      if (typingCallback) {
        typingCallback({
          currentlyTyping: new Set(["user1"]),
        });
      }

      // Wait for output to be generated
      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      // Restore spy
      logSpy.mockRestore();

      // Verify subscription was set up
      expect(mockTypingSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Find the JSON output with typing data from captured logs
      const typingOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return (
            parsed.currentlyTyping && Array.isArray(parsed.currentlyTyping)
          );
        } catch {
          return false;
        }
      });

      // Verify that typing event was actually output in JSON format
      expect(typingOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(typingOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed.currentlyTyping).toContain("user1");
    });
  });
});
