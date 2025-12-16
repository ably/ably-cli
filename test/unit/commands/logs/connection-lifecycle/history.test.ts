import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("logs:connection-lifecycle:history command", () => {
  let mockHistory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }

    // Set up mock for REST client
    mockHistory = vi.fn().mockResolvedValue({
      items: [
        {
          id: "msg-1",
          name: "connection.opened",
          data: { connectionId: "test-conn" },
          timestamp: Date.now(),
          clientId: "client-1",
          connectionId: "conn-1",
        },
      ],
    });

    const mockChannel = {
      name: "[meta]connection.lifecycle",
      history: mockHistory,
    };

    globalThis.__TEST_MOCKS__ = {
      ...globalThis.__TEST_MOCKS__,
      ablyRestMock: {
        channels: {
          get: vi.fn().mockReturnValue(mockChannel),
        },
        close: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }
  });

  describe("command flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["logs:connection-lifecycle:history", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --limit flag", async () => {
      const { error } = await runCommand(
        ["logs:connection-lifecycle:history", "--limit", "50"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/Unknown flag/);
    });

    it("should accept --direction flag", async () => {
      const { error } = await runCommand(
        ["logs:connection-lifecycle:history", "--direction", "forwards"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/Unknown flag/);
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history", "--json"],
        import.meta.url,
      );

      // Command should accept --json flag
      expect(stdout).toBeDefined();
    });
  });

  describe("history retrieval", () => {
    it("should retrieve connection lifecycle history and display results", async () => {
      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history"],
        import.meta.url,
      );

      expect(stdout).toContain("Found");
      expect(stdout).toContain("1");
      expect(stdout).toContain("connection lifecycle logs");
      expect(stdout).toContain("connection.opened");
      expect(mockHistory).toHaveBeenCalled();
    });

    it("should include messages array in JSON output", async () => {
      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toHaveProperty("name", "connection.opened");
    });

    it("should handle empty history", async () => {
      mockHistory.mockResolvedValue({ items: [] });

      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history"],
        import.meta.url,
      );

      expect(stdout).toContain("No connection lifecycle logs found");
    });

    it("should respect --limit flag", async () => {
      await runCommand(
        ["logs:connection-lifecycle:history", "--limit", "50"],
        import.meta.url,
      );

      expect(mockHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("should respect --direction flag", async () => {
      await runCommand(
        ["logs:connection-lifecycle:history", "--direction", "forwards"],
        import.meta.url,
      );

      expect(mockHistory).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "forwards" }),
      );
    });
  });
});
