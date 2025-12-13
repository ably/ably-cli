import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { RoomStatus } from "@ably/chat";

describe("rooms:reactions:subscribe command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockApiKey = `${mockAppId}.testkey:testsecret`;
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[apps."${mockAppId}"]
apiKey = "${mockApiKey}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }

    globalThis.__TEST_MOCKS__ = undefined;
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:reactions:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:reactions:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to reactions and display them", async () => {
      let reactionsCallback: ((event: any) => void) | null = null;
      let statusCallback: ((change: any) => void) | null = null;
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockReactionsSubscribe = vi.fn((callback) => {
        reactionsCallback = callback;
      });

      const mockOnStatusChange = vi.fn((callback) => {
        statusCallback = callback;
      });

      const mockRoom = {
        reactions: {
          subscribe: mockReactionsSubscribe,
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
        ablyChatMock: {
          rooms: mockRooms,
          realtime: mockRealtimeClient,
        } as any,
        ablyRealtimeMock: mockRealtimeClient as any,
      };

      const commandPromise = runCommand(
        ["rooms:reactions:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockReactionsSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a reaction event
      if (reactionsCallback) {
        reactionsCallback({
          reaction: {
            name: "heart",
            clientId: "client-123",
            metadata: { color: "red" },
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(mockRooms.get).toHaveBeenCalledWith("test-room");
      expect(mockReactionsSubscribe).toHaveBeenCalled();
      expect(mockRoom.attach).toHaveBeenCalled();

      // Verify output contains reaction data
      const output = capturedLogs.join("\n");
      expect(output).toContain("heart");
      expect(output).toContain("client-123");
    });

    it("should output JSON format when --json flag is used", async () => {
      let reactionsCallback: ((event: any) => void) | null = null;
      let statusCallback: ((change: any) => void) | null = null;
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      const mockReactionsSubscribe = vi.fn((callback) => {
        reactionsCallback = callback;
      });

      const mockOnStatusChange = vi.fn((callback) => {
        statusCallback = callback;
      });

      const mockRoom = {
        reactions: {
          subscribe: mockReactionsSubscribe,
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
        ablyChatMock: {
          rooms: mockRooms,
          realtime: mockRealtimeClient,
        } as any,
        ablyRealtimeMock: mockRealtimeClient as any,
      };

      const commandPromise = runCommand(
        ["rooms:reactions:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(mockReactionsSubscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate reaction event
      if (reactionsCallback) {
        reactionsCallback({
          reaction: {
            name: "thumbsup",
            clientId: "user1",
            metadata: {},
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

      // Find the JSON output with reaction data
      const reactionOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.name && parsed.clientId;
        } catch {
          return false;
        }
      });

      // Verify that reaction event was actually output in JSON format
      expect(reactionOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(reactionOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("name", "thumbsup");
      expect(parsed).toHaveProperty("clientId", "user1");
    });
  });
});
