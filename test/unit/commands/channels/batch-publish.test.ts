import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("channels:batch-publish command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();

    // Configure default successful response
    mock.request.mockResolvedValue({
      statusCode: 201,
      items: [
        { channel: "channel1", messageId: "msg-1" },
        { channel: "channel2", messageId: "msg-2" },
      ],
    });
  });

  standardHelpTests("channels:batch-publish", import.meta.url);
  standardArgValidationTests("channels:batch-publish", import.meta.url);
  standardFlagTests("channels:batch-publish", import.meta.url, [
    "--channels",
    "--channels-json",
    "--spec",
    "--name",
    "--encoding",
  ]);

  describe("input validation", () => {
    it("should require channels flag when not using --spec", async () => {
      const { error } = await runCommand(
        ["channels:batch-publish", '{"data":"test"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "You must specify either --channels, --channels-json, or --spec",
      );
    });

    it("should require message when not using --spec", async () => {
      const { error } = await runCommand(
        ["channels:batch-publish", "--channels", "channel1,channel2"],
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
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1,channel2",
          '{"data":"test message"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Sending batch publish request");
      expect(stdout).toContain("Batch publish successful");
      expect(mock.request).toHaveBeenCalledWith(
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
      const mock = getMockAblyRest();

      const { stdout, error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels-json",
          '["channel1","channel2"]', // No spaces - prevents argument splitting
          '{"data":"test"}',
        ],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain("Sending batch publish request");
      expect(stdout).toContain("Batch publish successful");
      expect(mock.request).toHaveBeenCalledWith(
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
      const mock = getMockAblyRest();

      const spec = JSON.stringify({
        channels: ["channel1", "channel2"],
        messages: { data: "spec message" },
      });

      await runCommand(
        ["channels:batch-publish", "--spec", spec],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledWith(
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
      const mock = getMockAblyRest();

      await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          "--name",
          "custom-event",
          '{"data":"test"}',
        ],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledWith(
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
      const mock = getMockAblyRest();

      await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          "--encoding",
          "base64",
          '{"data":"dGVzdA=="}',
        ],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledWith(
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
          "--json",
        ],
        import.meta.url,
      );

      expect(error).toBeUndefined();

      // In JSON mode, progress messages are suppressed by JSON guard
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channels");
      expect(result.channels).toEqual(["channel1", "channel2"]);
      expect(result).toHaveProperty("response");
    });

    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Publish failed"));

      const { error } = await runCommand(
        ["channels:batch-publish", "--channels", "channel1", '{"data":"test"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Publish failed");
    });

    it("should handle partial success response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
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
        ],
        import.meta.url,
      );

      expect(stdout).toContain("partially successful");
      // Verify successful channel output (resource() uses cyan, not quotes)
      expect(stdout).toContain("Published to channel");
      expect(stdout).toContain("channel1");
      expect(stdout).toContain("msg-1");
      // Verify failed channel output with error message and code
      expect(stdout).toContain("Failed to publish to channel");
      expect(stdout).toContain("channel2");
      expect(stdout).toContain("Invalid channel name (40000)");
    });

    it("should handle API errors in JSON mode", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Network error"));

      const { stdout, error } = await runCommand(
        [
          "channels:batch-publish",
          "--channels",
          "channel1",
          '{"data":"test"}',
          "--json",
        ],
        import.meta.url,
      );

      // In JSON mode, errors are output as JSON and the command exits with code 1
      expect(error).toBeDefined();

      // In JSON mode, progress messages are suppressed by JSON guard
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Network error");
    });
  });
});
