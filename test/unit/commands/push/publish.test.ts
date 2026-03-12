import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("push:publish command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:publish", import.meta.url);
  standardArgValidationTests("push:publish", import.meta.url);
  standardFlagTests("push:publish", import.meta.url, [
    "--json",
    "--device-id",
    "--client-id",
    "--title",
    "--body",
    "--payload",
  ]);

  describe("functionality", () => {
    it("should publish to a device", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "dev-1",
          "--title",
          "Hello",
          "--body",
          "World",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.objectContaining({
          notification: expect.objectContaining({
            title: "Hello",
            body: "World",
          }),
        }),
      );
    });

    it("should publish to a client", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:publish", "--client-id", "client-1", "--title", "Hi"],
        import.meta.url,
      );

      expect(stdout).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { clientId: "client-1" },
        expect.objectContaining({
          notification: expect.objectContaining({ title: "Hi" }),
        }),
      );
    });

    it("should publish with full payload", async () => {
      const mock = getMockAblyRest();
      const payload =
        '{"notification":{"title":"Custom"},"data":{"key":"val"}}';

      const { stdout } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", payload],
        import.meta.url,
      );

      expect(stdout).toContain("published");
      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "dev-1" },
        expect.objectContaining({
          notification: { title: "Custom" },
          data: { key: "val" },
        }),
      );
    });

    it("should require a recipient", async () => {
      const { error } = await runCommand(
        ["push:publish", "--title", "Hello"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--title", "Hi", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("published", true);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.publish.mockRejectedValue(new Error("Publish failed"));

      const { error } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--title", "Hi"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle invalid JSON in --payload", async () => {
      const { error } = await runCommand(
        ["push:publish", "--device-id", "dev-1", "--payload", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
