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

describe("push:config:show command", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("show configuration", () => {
    it("should show push config with APNs and FCM configured", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        apnsCertificate: "cert-data",
        apnsUsesSandboxCert: false,
        fcmProjectId: "my-project-123",
        fcmServiceAccount: "service-account-data",
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Test App");
      expect(stdout).toContain("APNs");
      expect(stdout).toContain("Configured");
      expect(stdout).toContain("FCM");
    });

    it("should show APNs token-based auth details", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        applePushKeyId: "ABC123XYZ",
        applePushTeamId: "TEAM123",
        applePushBundleId: "com.example.app",
        apnsUsesSandboxCert: true,
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("ABC123XYZ");
      expect(stdout).toContain("TEAM123");
      expect(stdout).toContain("com.example.app");
      expect(stdout).toContain("Token-based");
    });

    it("should show certificate-based auth type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        apnsCertificate: "cert-data",
        applePushKeyId: null,
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Certificate-based");
    });

    it("should show not configured status when no config exists", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        apnsCertificate: null,
        fcmProjectId: null,
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Not configured");
    });

    it("should output JSON when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        apnsCertificate: "cert-data",
        apnsUsesSandboxCert: false,
        applePushKeyId: "KEY123",
        applePushTeamId: "TEAM123",
        applePushBundleId: "com.example.app",
        fcmProjectId: "my-project-123",
        fcmServiceAccount: "service-account-data",
      });

      const { stdout } = await runCommand(
        ["push:config:show", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.appId).toBe(appId);
      expect(output.appName).toBe("Test App");
      expect(output.apns.configured).toBe(true);
      expect(output.apns.useSandbox).toBe(false);
      expect(output.apns.keyId).toBe("KEY123");
      expect(output.apns.teamId).toBe("TEAM123");
      expect(output.apns.bundleId).toBe("com.example.app");
      expect(output.fcm.configured).toBe(true);
      expect(output.fcm.projectId).toBe("my-project-123");
    });

    it("should show FCM project ID when configured", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        fcmProjectId: "firebase-project-456",
        fcmServiceAccount: "service-account-data",
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("firebase-project-456");
    });

    it("should show Web Push as available", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {});

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Web Push");
      expect(stdout).toContain("Available");
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
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

      const { error } = await runCommand(["push:config:show"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/500/);
    });

    it("should handle 401 authentication error", async () => {
      // Mock /me to fail with 401
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["push:config:show"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle app not found error", async () => {
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

      // Mock listApps to return empty (app not found)
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, []);

      const { error } = await runCommand(["push:config:show"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/i);
    });
  });
});
