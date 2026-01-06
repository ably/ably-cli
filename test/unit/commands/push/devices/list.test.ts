import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:devices:list command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.deviceRegistrations.list.mockReset();
    mock.push.admin.deviceRegistrations.list.mockResolvedValue({
      items: [
        {
          id: "device-1",
          platform: "android",
          formFactor: "phone",
          clientId: "client-1",
          push: { state: "ACTIVE" },
        },
        {
          id: "device-2",
          platform: "ios",
          formFactor: "tablet",
          push: { state: "ACTIVE" },
        },
      ],
      hasNext: () => false,
    });
  });

  describe("successful listing", () => {
    it("should list all devices", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:list"],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.list).toHaveBeenCalledOnce();
      expect(stdout).toContain("device-1");
      expect(stdout).toContain("device-2");
      expect(stdout).toContain("android");
      expect(stdout).toContain("ios");
    });

    it("should filter by --client-id", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue({
        items: [
          {
            id: "device-1",
            platform: "android",
            formFactor: "phone",
            clientId: "client-1",
            push: { state: "ACTIVE" },
          },
        ],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        ["push:devices:list", "--client-id", "client-1"],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.list).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "client-1" }),
      );
      expect(stdout).toContain("device-1");
    });

    it("should filter by --device-id", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue({
        items: [
          {
            id: "device-1",
            platform: "android",
            formFactor: "phone",
            push: { state: "ACTIVE" },
          },
        ],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        ["push:devices:list", "--device-id", "device-1"],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.list).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: "device-1" }),
      );
      expect(stdout).toContain("device-1");
    });

    it("should respect --limit flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(["push:devices:list", "--limit", "5"], import.meta.url);

      expect(mock.push.admin.deviceRegistrations.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
      );
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:list", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.devices).toBeDefined();
      expect(output.devices).toHaveLength(2);
      expect(output.devices[0].id).toBe("device-1");
      expect(mock.push.admin.deviceRegistrations.list).toHaveBeenCalledOnce();
    });

    it("should handle empty result set", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue({
        items: [],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        ["push:devices:list"],
        import.meta.url,
      );

      expect(stdout).toMatch(/no.*devices|0.*found/i);
    });

    it("should indicate when more results exist", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockResolvedValue({
        items: [
          {
            id: "device-1",
            platform: "android",
            formFactor: "phone",
            push: { state: "ACTIVE" },
          },
        ],
        hasNext: () => true,
      });

      const { stdout } = await runCommand(
        ["push:devices:list", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.hasMore).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.list.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        ["push:devices:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
