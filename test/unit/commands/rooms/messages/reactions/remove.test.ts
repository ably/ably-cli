import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("rooms:messages:reactions:remove command", () => {
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
    globalThis.__TEST_MOCKS__ = undefined;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial",
          "👍",
          "--unknown-flag-xyz",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:remove"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require messageSerial argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:remove", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require reaction argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:remove", "test-room", "msg-serial"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("removing reactions", () => {
    let mockReactionsDelete: ReturnType<typeof vi.fn>;
    let mockRoom: {
      attach: ReturnType<typeof vi.fn>;
      messages: { reactions: { delete: ReturnType<typeof vi.fn> } };
      onStatusChange: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockReactionsDelete = vi.fn().mockResolvedValue();

      mockRoom = {
        attach: vi.fn().mockResolvedValue(),
        messages: {
          reactions: {
            delete: mockReactionsDelete,
          },
        },
        onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockChatClient = {
        rooms: {
          get: vi.fn().mockResolvedValue(mockRoom),
          release: vi.fn().mockResolvedValue(),
        },
        connection: {
          onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
        },
        realtime: mockRealtimeClient,
        dispose: vi.fn().mockResolvedValue(),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRealtimeMock: mockRealtimeClient,
        ablyChatMock: mockChatClient,
      };
    });

    it("should remove a reaction from a message", async () => {
      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
        ],
        import.meta.url,
      );

      expect(mockRoom.attach).toHaveBeenCalled();
      expect(mockReactionsDelete).toHaveBeenCalledWith("msg-serial-123", {
        name: "👍",
      });
      expect(stdout).toContain("Removed reaction");
      expect(stdout).toContain("👍");
      expect(stdout).toContain("msg-serial-123");
      expect(stdout).toContain("test-room");
    });

    it("should remove a reaction with type flag", async () => {
      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "❤️",
          "--type",
          "unique",
        ],
        import.meta.url,
      );

      expect(mockReactionsDelete).toHaveBeenCalledWith("msg-serial-123", {
        name: "❤️",
        type: expect.any(String),
      });
      expect(stdout).toContain("Removed reaction");
      expect(stdout).toContain("❤️");
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("room", "test-room");
      expect(result).toHaveProperty("messageSerial", "msg-serial-123");
      expect(result).toHaveProperty("reaction", "👍");
    });

    it("should handle reaction removal failure", async () => {
      mockReactionsDelete.mockRejectedValue(
        new Error("Failed to remove reaction"),
      );

      const { error } = await runCommand(
        [
          "rooms:messages:reactions:remove",
          "test-room",
          "msg-serial-123",
          "👍",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Failed to remove reaction");
    });
  });
});
