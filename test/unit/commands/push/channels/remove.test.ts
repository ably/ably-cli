import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:channels:remove command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:channels:remove", import.meta.url);
  standardArgValidationTests("push:channels:remove", import.meta.url);
  standardFlagTests("push:channels:remove", import.meta.url, [
    "--json",
    "--channel",
    "--device-id",
    "--client-id",
    "--force",
  ]);

  describe("functionality", () => {
    it("should remove subscription with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "my-channel",
          "--device-id",
          "dev-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("removed");
      expect(mock.push.admin.channelSubscriptions.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "my-channel",
          deviceId: "dev-1",
        }),
      );
    });

    it("should require either device-id or client-id", async () => {
      const { error } = await runCommand(
        ["push:channels:remove", "--channel", "my-channel", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "my-channel",
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
      expect(result).toHaveProperty("subscription");
      expect(result.subscription).toHaveProperty("removed", true);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.remove.mockRejectedValue(
        new Error("Remove failed"),
      );

      const { error } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "my-channel",
          "--device-id",
          "dev-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
