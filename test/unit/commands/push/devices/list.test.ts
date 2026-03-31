import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:devices:list command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:devices:list", import.meta.url);
  standardArgValidationTests("push:devices:list", import.meta.url);
  standardFlagTests("push:devices:list", import.meta.url, [
    "--json",
    "--device-id",
    "--client-id",
    "--state",
    "--limit",
  ]);

  describe("functionality", () => {
    it("should list devices successfully", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue(
        createMockPaginatedResult([
          {
            id: "device-1",
            platform: "ios",
            formFactor: "phone",
            clientId: "client-1",
            push: {
              state: "ACTIVE",
              recipient: { transportType: "apns" },
            },
          },
        ]),
      );

      const { stdout } = await runCommand(
        ["push:devices:list"],
        import.meta.url,
      );

      expect(stdout).toContain("device-1");
      expect(stdout).toContain("ios");
      expect(stdout).toContain("ACTIVE");
    });

    it("should handle empty list", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue(
        createMockPaginatedResult([]),
      );

      const { stdout } = await runCommand(
        ["push:devices:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No device registrations found");
    });

    it("should output JSON when requested", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue(
        createMockPaginatedResult([{ id: "device-1", platform: "ios" }]),
      );

      const { stdout } = await runCommand(
        ["push:devices:list", "--json"],
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
      expect(result).toHaveProperty("devices");
      expect(result).toHaveProperty("hasMore", false);
    });

    it("should report hasMore and pagination warning with multi-page results", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue(
        createMockPaginatedResult(
          [{ id: "device-1", platform: "ios" }],
          [{ id: "device-2", platform: "android" }],
        ),
      );

      const { stdout } = await runCommand(
        ["push:devices:list", "--json", "--limit", "10"],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      ) as Record<string, unknown>;
      expect(result).toHaveProperty("hasMore", false);
      expect(result.devices).toHaveLength(2);
    });

    it("should pass filter params to SDK", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue(
        createMockPaginatedResult([]),
      );

      await runCommand(
        [
          "push:devices:list",
          "--device-id",
          "dev-1",
          "--client-id",
          "cli-1",
          "--state",
          "ACTIVE",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.list).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: "dev-1",
          clientId: "cli-1",
          state: "ACTIVE",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockRejectedValue(
        new Error("API error"),
      );

      const { error } = await runCommand(
        ["push:devices:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
