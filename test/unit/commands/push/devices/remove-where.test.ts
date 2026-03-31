import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:devices:remove-where command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:devices:remove-where", import.meta.url);
  standardArgValidationTests("push:devices:remove-where", import.meta.url);
  standardFlagTests("push:devices:remove-where", import.meta.url, [
    "--json",
    "--device-id",
    "--client-id",
    "--force",
  ]);

  describe("functionality", () => {
    it("should remove devices matching filter with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:remove-where", "--client-id", "client-1", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("removed");
      expect(
        mock.push.admin.deviceRegistrations.removeWhere,
      ).toHaveBeenCalledWith(expect.objectContaining({ clientId: "client-1" }));
    });

    it("should require at least one filter", async () => {
      const { error } = await runCommand(
        ["push:devices:remove-where", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        [
          "push:devices:remove-where",
          "--device-id",
          "dev-1",
          "--force",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("devices");
      expect(result.devices).toHaveProperty("removed", true);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.removeWhere.mockRejectedValue(
        new Error("Remove failed"),
      );

      const { error } = await runCommand(
        ["push:devices:remove-where", "--device-id", "dev-1", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
