import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:devices:remove command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:devices:remove", import.meta.url);
  standardArgValidationTests("push:devices:remove", import.meta.url, {
    requiredArgs: ["device-123"],
  });
  standardFlagTests("push:devices:remove", import.meta.url, [
    "--json",
    "--force",
  ]);

  describe("functionality", () => {
    it("should remove a device with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:remove", "device-123", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("device-123");
      expect(stdout).toContain("removed");
      expect(mock.push.admin.deviceRegistrations.remove).toHaveBeenCalledWith(
        "device-123",
      );
    });

    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        ["push:devices:remove", "device-123", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("device");
      expect(result.device).toHaveProperty("id", "device-123");
      expect(result.device).toHaveProperty("removed", true);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.remove.mockRejectedValue(
        new Error("Remove failed"),
      );

      const { error } = await runCommand(
        ["push:devices:remove", "device-123", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
