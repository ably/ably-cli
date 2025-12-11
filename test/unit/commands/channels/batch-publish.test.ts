import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRestMock?: unknown;
  };
}

describe("channels:batch-publish command", () => {
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRequest = vi.fn().mockResolvedValue({
      statusCode: 201,
      items: [
        { channel: "channel1", messageId: "msg-1" },
        { channel: "channel2", messageId: "msg-2" },
      ],
    });

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
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Publish messages to multiple Ably channels");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("batch-publish");
    });
  });

  describe("argument validation", () => {
    it("should require channels flag when not using --spec", async () => {
      const { error } = await runCommand(
        [
          "channels:batch-publish",
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "You must specify either --channels, --channels-json, or --spec",
      );
    });

    it("should require message when not using --spec", async () => {
      const { error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1,channel2",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "Message is required when not using --spec",
      );
    });
  });

  describe("batch publish functionality", () => {
    it("should publish to multiple channels using --channels flag", async () => {
      const { stdout } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1,channel2",
          '{"data":"test message"}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Sending batch publish request");
      expect(stdout).toContain("Batch publish successful");
      expect(mockRequest).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.objectContaining({
          channels: ["channel1", "channel2"],
          messages: expect.objectContaining({ data: "test message" }),
        }),
      );
    });

    it("should publish using --channels-json flag", async () => {
      const { stdout, error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels-json",
          '["channel1","channel2"]', // No spaces - prevents argument splitting
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain("Sending batch publish request");
      expect(stdout).toContain("Batch publish successful");
      expect(mockRequest).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.objectContaining({
          channels: ["channel1", "channel2"],
        }),
      );
    });

    it("should publish using --spec flag", async () => {
      const spec = JSON.stringify({
        channels: ["channel1", "channel2"],
        messages: { data: "spec message" },
      });

      await runCommand(
        [
          "channels:batch-publish",
          "--spec",
          spec,
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(mockRequest).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.objectContaining({
          channels: ["channel1", "channel2"],
          messages: { data: "spec message" },
        }),
      );
    });

    it("should include event name when --name flag is provided", async () => {
      await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          "--name",
          "custom-event",
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(mockRequest).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.objectContaining({
          messages: expect.objectContaining({ name: "custom-event" }),
        }),
      );
    });

    it("should include encoding when --encoding flag is provided", async () => {
      await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          "--encoding",
          "base64",
          '{"data":"dGVzdA=="}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(mockRequest).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.objectContaining({
          messages: expect.objectContaining({ encoding: "base64" }),
        }),
      );
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout, error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1,channel2",
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      expect(error).toBeUndefined();

      // stdout contains "Sending batch publish request..." before JSON
      expect(stdout).toContain("Sending batch publish request");

      // JSON is pretty-printed across multiple lines - extract it after the first line
      const lines = stdout.split("\n");
      const jsonStartIndex = lines.findIndex((line) => line.trim() === "{");
      expect(jsonStartIndex).toBeGreaterThan(-1);
      const jsonContent = lines.slice(jsonStartIndex).join("\n");
      const result = JSON.parse(jsonContent);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channels");
      expect(result.channels).toEqual(["channel1", "channel2"]);
      expect(result).toHaveProperty("response");
    });

    it("should handle API errors gracefully", async () => {
      mockRequest.mockRejectedValue(new Error("Publish failed"));

      const { error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to execute batch publish");
    });

    it("should handle partial success response", async () => {
      mockRequest.mockResolvedValue({
        statusCode: 400,
        items: {
          error: { code: 40020, message: "Partial failure" },
          batchResponse: [
            { channel: "channel1", messageId: "msg-1" },
            {
              channel: "channel2",
              error: { code: 40000, message: "Invalid channel name" },
            },
          ],
        },
      });

      const { stdout } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1,channel2",
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("partially successful");
      // Verify successful channel output
      expect(stdout).toContain(
        "Published to channel 'channel1' with messageId: msg-1",
      );
      // Verify failed channel output with error message and code
      expect(stdout).toContain(
        "Failed to publish to channel 'channel2': Invalid channel name (40000)",
      );
    });

    it("should handle API errors in JSON mode", async () => {
      mockRequest.mockRejectedValue(new Error("Network error"));

      const { stdout, error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          '{"data":"test"}',
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      // In JSON mode, errors are returned as JSON, not thrown
      expect(error).toBeUndefined();

      // stdout contains "Sending batch publish request..." before JSON
      expect(stdout).toContain("Sending batch publish request");

      // JSON is pretty-printed across multiple lines - extract it after the first line
      const lines = stdout.split("\n");
      const jsonStartIndex = lines.findIndex((line) => line.trim() === "{");
      expect(jsonStartIndex).toBeGreaterThan(-1);
      const jsonContent = lines.slice(jsonStartIndex).join("\n");
      const result = JSON.parse(jsonContent);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Network error");
    });
  });

  describe("flags", () => {
    it("should accept --channels flag", async () => {
      const { stdout } = await runCommand(
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--channels");
    });

    it("should accept --channels-json flag", async () => {
      const { stdout } = await runCommand(
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--channels-json");
    });

    it("should accept --spec flag", async () => {
      const { stdout } = await runCommand(
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--spec");
    });

    it("should accept --name flag", async () => {
      const { stdout } = await runCommand(
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--name");
    });

    it("should accept --encoding flag", async () => {
      const { stdout } = await runCommand(
        ["channels:batch-publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--encoding");
    });
  });
});
