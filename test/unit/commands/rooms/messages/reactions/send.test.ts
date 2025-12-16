import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("rooms:messages:reactions:send command", () => {
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
        [
          "rooms:messages:reactions:send",
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
        ["rooms:messages:reactions:send"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require messageSerial argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:send", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require reaction argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("sending reactions", () => {
    let mockReactionsSend: ReturnType<typeof vi.fn>;
    let mockRoom: {
      attach: ReturnType<typeof vi.fn>;
      messages: { reactions: { send: ReturnType<typeof vi.fn> } };
      onStatusChange: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockReactionsSend = vi.fn().mockResolvedValue();

      mockRoom = {
        attach: vi.fn().mockResolvedValue(),
        messages: {
          reactions: {
            send: mockReactionsSend,
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
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: mockRealtimeClient,
        ablyChatMock: mockChatClient,
      };
    });

    it("should send a reaction to a message", async () => {
      const { stdout } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial-123", "👍"],
        import.meta.url,
      );

      expect(mockRoom.attach).toHaveBeenCalled();
      expect(mockReactionsSend).toHaveBeenCalledWith("msg-serial-123", {
        name: "👍",
      });
      expect(stdout).toContain("Sent reaction");
      expect(stdout).toContain("👍");
      expect(stdout).toContain("msg-serial-123");
      expect(stdout).toContain("test-room");
    });

    it("should send a reaction with type flag", async () => {
      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:send",
          "test-room",
          "msg-serial-123",
          "❤️",
          "--type",
          "unique",
        ],
        import.meta.url,
      );

      expect(mockReactionsSend).toHaveBeenCalledWith("msg-serial-123", {
        name: "❤️",
        type: expect.any(String),
      });
      expect(stdout).toContain("Sent reaction");
      expect(stdout).toContain("❤️");
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        [
          "rooms:messages:reactions:send",
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

    it("should handle reaction send failure", async () => {
      mockReactionsSend.mockRejectedValue(new Error("Failed to send reaction"));

      const { error } = await runCommand(
        ["rooms:messages:reactions:send", "test-room", "msg-serial-123", "👍"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("Failed to send reaction");
    });
  });
});
