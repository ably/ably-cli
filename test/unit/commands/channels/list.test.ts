import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("channels:list command", () => {
  // Mock channel response data
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
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue(mockChannelsResponse);
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
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      // Verify the REST client request was called with correct parameters
      expect(mock.request).toHaveBeenCalledOnce();
      expect(mock.request.mock.calls[0][0]).toBe("get");
      expect(mock.request.mock.calls[0][1]).toBe("/channels");
      expect(mock.request.mock.calls[0][2]).toBe(2);
      expect(mock.request.mock.calls[0][3]).toEqual({ limit: 100 });

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

      expect(stdout).toContain("Connections: 5");
      expect(stdout).toContain("Publishers: 2");
      expect(stdout).toContain("Subscribers: 3");
    });

    it("should handle empty channels response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({ statusCode: 200, items: [] });

      const { stdout } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("No active channels found");
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({ statusCode: 400, error: "Bad Request" });

      const { error } = await runCommand(
        ["channels:list", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to list channels");
    });

    it("should respect limit flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--limit", "50"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      expect(mock.request.mock.calls[0][3]).toEqual({ limit: 50 });
    });

    it("should respect prefix flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        ["channels:list", "--api-key", "app.key:secret", "--prefix", "test-"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      expect(mock.request.mock.calls[0][3]).toEqual({
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

      // Verify the structure of the JSON output
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
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Network error"));

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
