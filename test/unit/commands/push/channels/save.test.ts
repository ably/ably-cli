import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:channels:save command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:channels:save", import.meta.url);
  standardArgValidationTests("push:channels:save", import.meta.url);
  standardFlagTests("push:channels:save", import.meta.url, [
    "--json",
    "--channel",
    "--device-id",
    "--client-id",
  ]);

  describe("functionality", () => {
    it("should save subscription with device ID", async () => {
      const mock = getMockAblyRest();

      const { stderr } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "my-channel",
          "--device-id",
          "device-1",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Subscribed");
      expect(stderr).toContain("my-channel");
      expect(mock.push.admin.channelSubscriptions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "my-channel",
          deviceId: "device-1",
        }),
      );
    });

    it("should save subscription with client ID", async () => {
      const mock = getMockAblyRest();

      const { stderr } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "my-channel",
          "--client-id",
          "client-1",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Subscribed");
      expect(mock.push.admin.channelSubscriptions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "my-channel",
          clientId: "client-1",
        }),
      );
    });

    it("should require either device-id or client-id", async () => {
      const { error } = await runCommand(
        ["push:channels:save", "--channel", "my-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should output JSON when requested", async () => {
      const { stdout } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "my-channel",
          "--device-id",
          "dev-1",
          "--json",
        ],
        import.meta.url,
      );

      // Parse NDJSON output — find the result record
      const records = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("subscription");
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.save.mockRejectedValue(
        new Error("Save failed"),
      );

      const { error } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "my-channel",
          "--device-id",
          "dev-1",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
