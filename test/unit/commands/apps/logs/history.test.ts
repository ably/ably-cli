import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("apps:logs:history command", () => {
  let mockHistory: ReturnType<typeof vi.fn>;
  let mockChannelGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }

    // Setup global mock for Ably REST client
    mockHistory = vi.fn().mockResolvedValue({
      items: [],
    });

    mockChannelGet = vi.fn().mockReturnValue({
      history: mockHistory,
    });

    globalThis.__TEST_MOCKS__ = {
      ...globalThis.__TEST_MOCKS__,
      ablyRestMock: {
        channels: {
          get: mockChannelGet,
        },
      } as any,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }
  });

  describe("successful log history retrieval", () => {
    it("should retrieve application log history", async () => {
      const mockTimestamp = 1234567890000;
      const mockLogMessage = "User login successful";
      const mockLogLevel = "info";

      mockHistory.mockResolvedValue({
        items: [
          {
            name: "log.info",
            data: {
              message: mockLogMessage,
              level: mockLogLevel,
              userId: "user123",
            },
            timestamp: mockTimestamp,
          },
        ],
      });

      const { stdout } = await runCommand(
        ["apps:logs:history"],
        import.meta.url,
      );

      // Verify the correct channel was requested
      expect(mockChannelGet).toHaveBeenCalledWith("[meta]log");

      // Verify history was called with default parameters
      expect(mockHistory).toHaveBeenCalledWith({
        direction: "backwards",
        limit: 100,
      });

      // Verify output contains the log count
      expect(stdout).toContain("Found 1 application log messages");

      // Verify output contains the log event name
      expect(stdout).toContain("log.info");

      // Verify output contains the actual log message content
      expect(stdout).toContain(mockLogMessage);
      expect(stdout).toContain(mockLogLevel);
      expect(stdout).toContain("user123");
    });

    it("should handle empty log history", async () => {
      mockHistory.mockResolvedValue({
        items: [],
      });

      const { stdout } = await runCommand(
        ["apps:logs:history"],
        import.meta.url,
      );

      expect(stdout).toContain("No application log messages found");
    });

    it("should accept limit flag", async () => {
      mockHistory.mockResolvedValue({
        items: [],
      });

      await runCommand(["apps:logs:history", "--limit", "50"], import.meta.url);

      // Verify history was called with custom limit
      expect(mockHistory).toHaveBeenCalledWith({
        direction: "backwards",
        limit: 50,
      });
    });

    it("should accept direction flag", async () => {
      mockHistory.mockResolvedValue({
        items: [],
      });

      await runCommand(
        ["apps:logs:history", "--direction", "forwards"],
        import.meta.url,
      );

      // Verify history was called with forwards direction
      expect(mockHistory).toHaveBeenCalledWith({
        direction: "forwards",
        limit: 100,
      });
    });

    it("should display multiple log messages with their content", async () => {
      const timestamp1 = 1234567890000;
      const timestamp2 = 1234567891000;

      mockHistory.mockResolvedValue({
        items: [
          {
            name: "log.info",
            data: { message: "First log entry", operation: "login" },
            timestamp: timestamp1,
          },
          {
            name: "log.error",
            data: { message: "Error occurred", error: "Database timeout" },
            timestamp: timestamp2,
          },
        ],
      });

      const { stdout } = await runCommand(
        ["apps:logs:history"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 2 application log messages");
      expect(stdout).toContain("log.info");
      expect(stdout).toContain("log.error");

      // Verify actual log content is displayed
      expect(stdout).toContain("First log entry");
      expect(stdout).toContain("login");
      expect(stdout).toContain("Error occurred");
      expect(stdout).toContain("Database timeout");
    });

    it("should handle string data in messages", async () => {
      mockHistory.mockResolvedValue({
        items: [
          {
            name: "log.warning",
            data: "Simple string log message",
            timestamp: Date.now(),
          },
        ],
      });

      const { stdout } = await runCommand(
        ["apps:logs:history"],
        import.meta.url,
      );

      expect(stdout).toContain("Simple string log message");
    });

    it("should show limit warning when max messages reached", async () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        name: "log.info",
        data: `Message ${i}`,
        timestamp: Date.now() + i,
      }));

      mockHistory.mockResolvedValue({
        items: messages,
      });

      const { stdout } = await runCommand(
        ["apps:logs:history", "--limit", "50"],
        import.meta.url,
      );

      expect(stdout).toContain("Showing maximum of 50 messages");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockMessage = {
        name: "log.info",
        data: { message: "Test message", severity: "info" },
        timestamp: Date.now(),
      };

      mockHistory.mockResolvedValue({
        items: [mockMessage],
      });

      const { stdout } = await runCommand(
        ["apps:logs:history", "--json"],
        import.meta.url,
      );

      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty("messages");
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.messages[0]).toHaveProperty("name", "log.info");
      expect(parsed.messages[0].data).toHaveProperty("message", "Test message");
    });
  });
});
