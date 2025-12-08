import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRestMock?: unknown;
  };
}

describe("channels:history command", () => {
  let mockHistory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHistory = vi.fn().mockResolvedValue({
      items: [
        {
          id: "msg-1",
          name: "test-event",
          data: { text: "Hello world" },
          timestamp: 1700000000000,
          clientId: "client-1",
          connectionId: "conn-1",
        },
        {
          id: "msg-2",
          name: "another-event",
          data: "Plain text message",
          timestamp: 1700000001000,
          clientId: "client-2",
          connectionId: "conn-2",
        },
      ],
    });

    const mockChannel = {
      name: "test-channel",
      history: mockHistory,
    };

    globalThis.__TEST_MOCKS__ = {
      ablyRestMock: {
        channels: {
          get: vi.fn().mockReturnValue(mockChannel),
        },
        close: vi.fn(),
      },
    };
  });

  afterEach(() => {
    delete globalThis.__TEST_MOCKS__;
    vi.clearAllMocks();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Retrieve message history");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("CHANNEL");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("history");
    });
  });

  describe("argument validation", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(["channels:history"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/missing.*channel|required/i);
    });
  });

  describe("history retrieval", () => {
    it("should retrieve channel history successfully", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("Found");
      expect(stdout).toContain("2");
      expect(stdout).toContain("messages");
      expect(mockHistory).toHaveBeenCalled();
    });

    it("should display message details", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("test-event");
      expect(stdout).toContain("Hello world");
      expect(stdout).toContain("client-1");
    });

    it("should handle empty history", async () => {
      mockHistory.mockResolvedValue({ items: [] });

      const { stdout } = await runCommand(
        ["channels:history", "test-channel", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("No messages found");
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        [
          "channels:history",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toHaveProperty("id", "msg-1");
      expect(result.messages[0]).toHaveProperty("name", "test-event");
      expect(result.messages[0]).toHaveProperty("data");
      expect(result.messages[0].data).toEqual({ text: "Hello world" });
    });

    it("should respect --limit flag", async () => {
      await runCommand(
        [
          "channels:history",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--limit",
          "10",
        ],
        import.meta.url,
      );

      expect(mockHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });

    it("should respect --direction flag", async () => {
      await runCommand(
        [
          "channels:history",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--direction",
          "forwards",
        ],
        import.meta.url,
      );

      expect(mockHistory).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "forwards" }),
      );
    });

    it("should respect --start and --end flags", async () => {
      const start = "2023-01-01T00:00:00Z";
      const end = "2023-01-02T00:00:00Z";

      await runCommand(
        [
          "channels:history",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--start",
          start,
          "--end",
          end,
        ],
        import.meta.url,
      );

      expect(mockHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          start: new Date(start).getTime(),
          end: new Date(end).getTime(),
        }),
      );
    });

    it("should handle API errors gracefully", async () => {
      mockHistory.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:history", "test-channel", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Error retrieving channel history");
    });
  });

  describe("flags", () => {
    it("should pass cipher option to channel when --cipher flag is used", async () => {
      const mockChannelsGet = (
        globalThis.__TEST_MOCKS__?.ablyRestMock as {
          channels: { get: ReturnType<typeof vi.fn> };
        }
      )?.channels.get;

      await runCommand(
        [
          "channels:history",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--cipher",
          "my-encryption-key",
        ],
        import.meta.url,
      );

      // Verify channel.get was called with cipher option
      expect(mockChannelsGet).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          cipher: { key: "my-encryption-key" },
        }),
      );
    });
  });
});
