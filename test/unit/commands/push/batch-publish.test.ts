import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("push:batch-publish command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:batch-publish", import.meta.url);
  standardArgValidationTests("push:batch-publish", import.meta.url);
  standardFlagTests("push:batch-publish", import.meta.url, [
    "--json",
    "--force",
  ]);

  describe("functionality", () => {
    it("should batch publish notifications", async () => {
      const mock = getMockAblyRest();
      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { stdout } = await runCommand(
        ["push:batch-publish", payload, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("published");
      expect(mock.request).toHaveBeenCalledWith(
        "post",
        "/push/batch/publish",
        2,
        null,
        expect.any(Array),
      );
    });

    it("should batch publish to channels", async () => {
      const mock = getMockAblyRest();
      const payload =
        '[{"channels":["my-channel"],"payload":{"notification":{"title":"Hello"}}}]';

      const { stdout } = await runCommand(
        ["push:batch-publish", payload, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("published");
      expect(mock.request).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.any(Array),
      );
    });

    it("should output JSON when requested", async () => {
      getMockAblyRest();
      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { stdout } = await runCommand(
        ["push:batch-publish", payload, "--json", "--force"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("publish");
      expect(result.publish).toHaveProperty("total", 1);
      expect(result.publish).toHaveProperty("succeeded");
      expect(result.publish).toHaveProperty("failed", 0);
    });
  });

  describe("argument validation", () => {
    it("should reject invalid JSON", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject non-array JSON", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", '{"not":"array"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should accept channels as a single string", async () => {
      const mock = getMockAblyRest();
      const payload =
        '[{"channels":"my-channel","payload":{"notification":{"title":"Hello"}}}]';

      const { stdout } = await runCommand(
        ["push:batch-publish", payload, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("published");
      expect(mock.request).toHaveBeenCalledWith(
        "post",
        "/messages",
        2,
        null,
        expect.any(Array),
      );
    });

    it("should reject items missing both recipient and channels", async () => {
      const payload =
        '[{"payload":{"notification":{"title":"Hello","body":"World"}}}]';

      const { error } = await runCommand(
        ["push:batch-publish", payload],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("recipient");
    });

    it("should reject items missing notification and data", async () => {
      const payload = '[{"recipient":{"deviceId":"dev-1"},"payload":{}}]';

      const { error } = await runCommand(
        ["push:batch-publish", payload],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Batch publish failed"));

      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { error } = await runCommand(
        ["push:batch-publish", payload, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should include originalIndex in failedItems for recipient failures", async () => {
      const mock = getMockAblyRest();
      // Return two items, second one failed
      mock.request.mockResolvedValueOnce({
        items: [
          { statusCode: 200 },
          { error: { message: "Device not found", code: 40400 } },
        ],
        statusCode: 200,
        success: true,
      });

      // Items at original indices 0 and 1
      const payload = JSON.stringify([
        {
          recipient: { deviceId: "dev-ok" },
          payload: { notification: { title: "Hello" } },
        },
        {
          recipient: { deviceId: "dev-fail" },
          payload: { notification: { title: "Hello" } },
        },
      ]);

      const { stdout } = await runCommand(
        ["push:batch-publish", payload, "--json", "--force"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.publish.failed).toBeTruthy();
      expect(result.publish.failedItems).toHaveLength(1);
      expect(result.publish.failedItems[0].originalIndex).toBe(1);
    });

    it("should include originalIndex for channel failures in mixed batch", async () => {
      const mock = getMockAblyRest();
      // First call: recipient items (index 0) — success
      mock.request.mockResolvedValueOnce({
        items: [{ statusCode: 200 }],
        statusCode: 200,
        success: true,
      });
      // Second call: channel items (index 1) — failure
      mock.request.mockResolvedValueOnce({
        items: [
          {
            channel: "bad-channel",
            error: { message: "Channel error", code: 40400 },
          },
        ],
        statusCode: 200,
        success: true,
      });

      // Mixed batch: recipient at index 0, channel at index 1
      const payload = JSON.stringify([
        {
          recipient: { deviceId: "dev-1" },
          payload: { notification: { title: "Hello" } },
        },
        {
          channels: ["bad-channel"],
          payload: { notification: { title: "Hello" } },
        },
      ]);

      const { stdout } = await runCommand(
        ["push:batch-publish", payload, "--json", "--force"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.publish.failed).toBeTruthy();
      expect(result.publish.failedItems).toHaveLength(1);
      expect(result.publish.failedItems[0].originalIndex).toBe(1);
    });

    it("should handle HTTP error responses from API", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        success: false,
        statusCode: 401,
        errorCode: 40101,
        errorMessage: "Invalid credentials",
      });

      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { error } = await runCommand(
        ["push:batch-publish", payload, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid credentials");
    });

    it("should surface errorCode and errorMessage from HTTP response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        success: false,
        statusCode: 403,
        errorCode: 40300,
        errorMessage: "Push not enabled",
      });

      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { error } = await runCommand(
        ["push:batch-publish", payload, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Push not enabled");
      expect(error?.message).toContain("40300");
    });
  });
});
