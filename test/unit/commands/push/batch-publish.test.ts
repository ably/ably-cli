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
    "--payload",
  ]);

  describe("functionality", () => {
    it("should batch publish notifications", async () => {
      const mock = getMockAblyRest();
      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { stdout } = await runCommand(
        ["push:batch-publish", "--payload", payload],
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

    it("should output JSON when requested", async () => {
      getMockAblyRest();
      const payload =
        '[{"recipient":{"deviceId":"dev-1"},"payload":{"notification":{"title":"Hello"}}}]';

      const { stdout } = await runCommand(
        ["push:batch-publish", "--payload", payload, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("published", true);
      expect(result).toHaveProperty("total", 1);
      expect(result).toHaveProperty("succeeded");
      expect(result).toHaveProperty("failed", 0);
    });

    it("should require --payload flag", async () => {
      const { error } = await runCommand(
        ["push:batch-publish"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject invalid JSON", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "--payload", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject non-array JSON", async () => {
      const { error } = await runCommand(
        ["push:batch-publish", "--payload", '{"not":"array"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject items missing recipient", async () => {
      const payload = '[{"notification":{"title":"Hello"}}]';

      const { error } = await runCommand(
        ["push:batch-publish", "--payload", payload],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject items missing notification and data", async () => {
      const payload = '[{"recipient":{"deviceId":"dev-1"},"payload":{}}]';

      const { error } = await runCommand(
        ["push:batch-publish", "--payload", payload],
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
        ["push:batch-publish", "--payload", payload],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
