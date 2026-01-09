import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

// Helper to set up common mocks for Control API
function setupControlApiMocks(
  appId: string,
  appConfig: Record<string, unknown> = {},
) {
  const mockConfig = getMockConfigManager();
  const accountId = mockConfig.getCurrentAccount()?.accountId || "test-account";

  // Mock /me endpoint (called by listApps -> getMe)
  nock("https://control.ably.net")
    .get("/v1/me")
    .reply(200, {
      account: { id: accountId, name: "Test Account" },
      user: { email: "test@example.com" },
    });

  // Mock listApps endpoint (called by getApp -> listApps)
  nock("https://control.ably.net")
    .get(`/v1/accounts/${accountId}/apps`)
    .reply(200, [
      {
        id: appId,
        name: "Test App",
        ...appConfig,
      },
    ]);
}

describe("push:config:clear-apns command", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("when APNs is configured", () => {
    it("should clear APNs configuration with --force flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Use apnsAuthType to indicate APNs is configured (new Control API field)
      setupControlApiMocks(appId, {
        apnsAuthType: "certificate",
      });

      // Mock updateApp to clear APNs
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("APNs configuration cleared successfully");
    });

    it("should output JSON when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Use apnsAuthType to indicate APNs is configured (new Control API field)
      setupControlApiMocks(appId, {
        apnsAuthType: "certificate",
      });

      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force", "--json"],
        import.meta.url,
      );

      // Extract JSON from output (command may log progress messages)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();
      const output = JSON.parse(jsonMatch![0]);
      expect(output.success).toBe(true);
      expect(output.appId).toBe(appId);
      expect(output.message).toBe("APNs configuration cleared");
    });
  });

  describe("when APNs is not configured", () => {
    it("should handle no APNs config to clear", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // No APNs configuration - apnsAuthType is null
        apnsAuthType: null,
      });

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(stdout).toMatch(/no apns configuration/i);
    });

    it("should show message when no config exists in JSON mode", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // No APNs configuration - apnsAuthType is null
        apnsAuthType: null,
      });

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.message).toBe("No APNs configuration to clear");
    });
  });

  describe("error handling", () => {
    it("should handle API errors when getting app info", async () => {
      const mockConfig = getMockConfigManager();
      const accountId =
        mockConfig.getCurrentAccount()?.accountId || "test-account";

      // Mock /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock listApps to fail
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(500, { error: "Server error" });

      const { error } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/500/);
    });

    it("should handle API errors when clearing config", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Use apnsAuthType to indicate APNs is configured (new Control API field)
      setupControlApiMocks(appId, {
        apnsAuthType: "certificate",
      });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(400, { error: "Failed to update" });

      const { error } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle 401 authentication error", async () => {
      // Mock /me to fail with 401
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
