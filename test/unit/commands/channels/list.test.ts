import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRestMock?: unknown;
  };
}

describe("channels:list command", () => {
  let mockRequest: ReturnType<typeof vi.fn>;

  // Mock channel response data - preserving original test data structure
  const mockChannelsResponse = {
    statusCode: 200,
    items: [
      {
        channelId: "test-channel-1",
        status: {
          occupancy: {
            metrics: {
              connections: 5,
              publishers: 2,
              subscribers: 3,
              presenceConnections: 1,
              presenceMembers: 2,
            },
          },
        },
      },
      {
        channelId: "test-channel-2",
        status: {
          occupancy: {
            metrics: {
              connections: 3,
              publishers: 1,
              subscribers: 2,
            },
          },
        },
      },
    ],
  };

  beforeEach(() => {
    mockRequest = vi.fn().mockResolvedValue(mockChannelsResponse);

    globalThis.__TEST_MOCKS__ = {
      ablyRestMock: {
        request: mockRequest,
        close: vi.fn(),
      },
    };
  });

  afterEach(() => {
    delete globalThis.__TEST_MOCKS__;
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("List active channels");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("channels list");
    });
  });

  describe("channel listing", () => {
    it("should list channels successfully", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      // Verify the REST client request was called with correct parameters
      expect(mockRequest).toHaveBeenCalledOnce();
      expect(mockRequest.mock.calls[0][0]).toBe("get");
      expect(mockRequest.mock.calls[0][1]).toBe("/channels");
      expect(mockRequest.mock.calls[0][2]).toBe(2);
      expect(mockRequest.mock.calls[0][3]).toEqual({ limit: 100 });

      // Verify output contains channel info
      expect(stdout).toContain("Found");
      expect(stdout).toContain("2");
      expect(stdout).toContain("active channels");
      expect(stdout).toContain("test-channel-1");
      expect(stdout).toContain("test-channel-2");
    });

    it("should display channel metrics", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("Connections:");
      expect(stdout).toContain("Publishers:");
      expect(stdout).toContain("Subscribers:");
    });

    it("should handle empty channels response", async () => {
      mockRequest.mockResolvedValue({ statusCode: 200, items: [] });

      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("No active channels found");
    });

    it("should handle API errors", async () => {
      mockRequest.mockResolvedValue({ statusCode: 400, error: "Bad Request" });

      const { error } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to list channels");
    });

    it("should respect limit flag", async () => {
      await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--limit", "50"],
        import.meta.url,
      );

      expect(mockRequest).toHaveBeenCalledOnce();
      expect(mockRequest.mock.calls[0][3]).toEqual({ limit: 50 });
    });

    it("should respect prefix flag", async () => {
      await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--prefix", "test-"],
        import.meta.url,
      );

      expect(mockRequest).toHaveBeenCalledOnce();
      expect(mockRequest.mock.calls[0][3]).toEqual({
        limit: 100,
        prefix: "test-",
      });
    });
  });

  describe("JSON output", () => {
    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--json"],
        import.meta.url,
      );

      // Parse the JSON that was output
      const jsonOutput = JSON.parse(stdout);

      // Verify the structure of the JSON output (preserving original assertions)
      expect(jsonOutput).toHaveProperty("channels");
      expect(jsonOutput.channels).toBeInstanceOf(Array);
      expect(jsonOutput.channels).toHaveLength(2);
      expect(jsonOutput.channels[0]).toHaveProperty(
        "channelId",
        "test-channel-1",
      );
      expect(jsonOutput.channels[0]).toHaveProperty("metrics");
      expect(jsonOutput).toHaveProperty("success", true);
      expect(jsonOutput).toHaveProperty("total", 2);
      expect(jsonOutput).toHaveProperty("hasMore", false);
      expect(jsonOutput).toHaveProperty("timestamp");
    });

    it("should include channel metrics in JSON output", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--json"],
        import.meta.url,
      );

      const jsonOutput = JSON.parse(stdout);

      // Verify metrics are included
      expect(jsonOutput.channels[0].metrics).toEqual({
        connections: 5,
        publishers: 2,
        subscribers: 3,
        presenceConnections: 1,
        presenceMembers: 2,
      });
    });

    it("should handle API errors in JSON mode", async () => {
      mockRequest.mockRejectedValue(new Error("Network error"));

      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Network error");
      expect(result).toHaveProperty("status", "error");
    });
  });

  describe("flags", () => {
    it("should accept --limit flag", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--limit");
    });

    it("should accept --prefix flag", async () => {
      const { stdout } = await runCommand(
        ["channels:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--prefix");
    });
  });
});
