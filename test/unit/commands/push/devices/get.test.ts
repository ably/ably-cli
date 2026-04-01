import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:devices:get command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:devices:get", import.meta.url);
  standardArgValidationTests("push:devices:get", import.meta.url, {
    requiredArgs: ["device-123"],
  });
  standardFlagTests("push:devices:get", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should get device details with redacted token", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.get.mockResolvedValue({
        id: "device-123",
        platform: "ios",
        formFactor: "phone",
        clientId: "client-1",
        push: {
          state: "ACTIVE",
          recipient: {
            transportType: "apns",
            deviceToken: "abcdef1234567890",
          },
        },
      });

      const { stdout } = await runCommand(
        ["push:devices:get", "device-123"],
        import.meta.url,
      );

      expect(stdout).toContain("device-123");
      expect(stdout).toContain("ios");
      expect(stdout).toContain("ACTIVE");
      expect(stdout).toContain("abcd...7890 (redacted)");
      expect(stdout).not.toContain("abcdef1234567890");
    });

    it("should output JSON when requested", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.get.mockResolvedValue({
        id: "device-123",
        platform: "ios",
      });

      const { stdout } = await runCommand(
        ["push:devices:get", "device-123", "--json"],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      );
      expect(result).toBeDefined();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("device");
    });

    it("should call SDK with correct device ID", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.get.mockResolvedValue({
        id: "device-123",
      });

      await runCommand(["push:devices:get", "device-123"], import.meta.url);

      expect(mock.push.admin.deviceRegistrations.get).toHaveBeenCalledWith(
        "device-123",
      );
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.get.mockRejectedValue(
        new Error("Device not found"),
      );

      const { error } = await runCommand(
        ["push:devices:get", "device-123"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
