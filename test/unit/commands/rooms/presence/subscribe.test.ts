import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { RoomStatus } from "@ably/chat";

describe("rooms:presence:subscribe command", () => {
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
        ["rooms:presence:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:presence:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to presence events and display them", async () => {
      let presenceCallback: ((event: any) => void) | null = null;
      let statusCallback: ((change: any) => void) | null = null;
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockPresenceSubscribe = vi.fn((callback) => {
        presenceCallback = callback;
      });

      const mockOnStatusChange = vi.fn((callback) => {
        statusCallback = callback;
      });

      const mockRoom = {
        presence: {
          subscribe: mockPresenceSubscribe,
          get: vi.fn().mockResolvedValue([]),
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
        ["rooms:presence:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockPresenceSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a presence event
      if (presenceCallback) {
        presenceCallback({
          type: "enter",
          member: {
            clientId: "user-123",
            data: { name: "Test User" },
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(mockRooms.get).toHaveBeenCalledWith("test-room");
      expect(mockPresenceSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Verify output contains presence data
      const output = capturedLogs.join("\n");
      expect(output).toContain("user-123");
      expect(output).toContain("enter");
    });

    it("should output JSON format when --json flag is used", async () => {
      let presenceCallback: ((event: any) => void) | null = null;
      let statusCallback: ((change: any) => void) | null = null;
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockPresenceSubscribe = vi.fn((callback) => {
        presenceCallback = callback;
      });

      const mockOnStatusChange = vi.fn((callback) => {
        statusCallback = callback;
      });

      const mockRoom = {
        presence: {
          subscribe: mockPresenceSubscribe,
          get: vi.fn().mockResolvedValue([]),
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
        ["rooms:presence:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockPresenceSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate presence event
      if (presenceCallback) {
        presenceCallback({
          type: "leave",
          member: {
            clientId: "user-456",
            data: {},
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(mockPresenceSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Find the JSON output with presence data
      const presenceOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.type && parsed.member && parsed.member.clientId;
        } catch {
          return false;
        }
      });

      // Verify that presence event was actually output in JSON format
      expect(presenceOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(presenceOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("type", "leave");
      expect(parsed.member).toHaveProperty("clientId", "user-456");
    });
  });
});
