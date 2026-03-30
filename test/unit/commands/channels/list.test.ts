import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("channels:list command", () => {
  // Mock channel response data
  const mockChannelsResponse = {
    ...createMockPaginatedResult([
      { channelId: "test-channel-1" },
      { channelId: "test-channel-2" },
    ]),
    statusCode: 200,
  };

  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue(mockChannelsResponse);
  });

  standardHelpTests("channels:list", import.meta.url);
  standardArgValidationTests("channels:list", import.meta.url);
  standardFlagTests("channels:list", import.meta.url, ["--limit", "--prefix"]);

  describe("functionality", () => {
    it("should list channels successfully", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(["channels:list"], import.meta.url);

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

    it("should handle empty channels response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        ...createMockPaginatedResult([]),
        statusCode: 200,
      });

      const { stdout } = await runCommand(["channels:list"], import.meta.url);

      expect(stdout).toContain("No active channels found");
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({ statusCode: 400, error: "Bad Request" });

      const { error } = await runCommand(["channels:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to list channels");
    });

    it("should surface errorCode and errorMessage from HTTP response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        statusCode: 401,
        errorCode: 40101,
        errorMessage: "Invalid credentials",
      });

      const { error } = await runCommand(["channels:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid credentials");
      expect(error?.message).toContain("40101");
    });

    it("should respect limit flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(["channels:list", "--limit", "50"], import.meta.url);

      expect(mock.request).toHaveBeenCalledOnce();
      expect(mock.request.mock.calls[0][3]).toEqual({ limit: 50 });
    });

    it("should respect prefix flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(["channels:list", "--prefix", "test-"], import.meta.url);

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
        ["channels:list", "--json"],
        import.meta.url,
      );

      // Parse the JSON that was output
      const jsonOutput = JSON.parse(stdout);

      // Verify the structure of the JSON output
      expect(jsonOutput).toHaveProperty("channels");
      expect(jsonOutput.channels).toBeInstanceOf(Array);
      expect(jsonOutput.channels).toHaveLength(2);
      expect(jsonOutput.channels[0]).toEqual("test-channel-1");
      expect(jsonOutput.channels[1]).toEqual("test-channel-2");
      expect(jsonOutput).toHaveProperty("success", true);
      expect(jsonOutput).toHaveProperty("total", 2);
      expect(jsonOutput).toHaveProperty("hasMore", false);
      expect(jsonOutput).toHaveProperty("timestamp");
    });

    it("should handle API errors in JSON mode", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Network error"));

      const { stdout } = await runCommand(
        ["channels:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("Network error");
      expect(result).toHaveProperty("type", "error");
    });
  });

  describe("error handling", () => {
    it("should handle network errors gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Network error"));

      const { error } = await runCommand(["channels:list"], import.meta.url);

      expect(error).toBeDefined();
    });
  });
});
