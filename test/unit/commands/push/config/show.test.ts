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
    // Tests using NEW Control API response fields:
    // - apnsAuthType: 'token' | 'certificate' | null
    // - fcmProjectId: string | null
    // - apnsUseSandboxEndpoint: boolean | null

    it("should show push config with APNs certificate and FCM configured", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // New fields from Control API
        apnsAuthType: "certificate",
        apnsUseSandboxEndpoint: false,
        fcmProjectId: "my-project-123",
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Test App");
      expect(stdout).toContain("APNs");
      expect(stdout).toContain("Configured");
      expect(stdout).toContain("FCM");
      expect(stdout).toContain("Certificate-based");
    });

    it("should show APNs token-based auth type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // New field: apnsAuthType indicates token-based auth
        apnsAuthType: "token",
        apnsUseSandboxEndpoint: true,
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Token-based");
      expect(stdout).toContain("Sandbox"); // Because apnsUseSandboxEndpoint is true
    });

    it("should show certificate-based auth type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // New field: apnsAuthType indicates certificate-based auth
        apnsAuthType: "certificate",
        apnsUseSandboxEndpoint: false,
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Certificate-based");
      expect(stdout).toContain("Production"); // Because apnsUseSandboxEndpoint is false
    });

    it("should show not configured status when no config exists", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // New fields: null values indicate not configured
        apnsAuthType: null,
        fcmProjectId: null,
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Not configured");
    });

    it("should output JSON with new response format", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // New Control API response fields
        apnsAuthType: "token",
        apnsUseSandboxEndpoint: false,
        fcmProjectId: "my-project-123",
      });

      const { stdout } = await runCommand(
        ["push:config:show", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.appId).toBe(appId);
      expect(output.appName).toBe("Test App");
      expect(output.apns.configured).toBe(true);
      expect(output.apns.authType).toBe("token");
      expect(output.apns.useSandbox).toBe(false);
      expect(output.fcm.configured).toBe(true);
      expect(output.fcm.projectId).toBe("my-project-123");
    });

    it("should output JSON when not configured", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        apnsAuthType: null,
        fcmProjectId: null,
      });

      const { stdout } = await runCommand(
        ["push:config:show", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.apns.configured).toBe(false);
      expect(output.apns.authType).toBe(null);
      expect(output.fcm.configured).toBe(false);
      expect(output.fcm.projectId).toBe(null);
    });

    it("should show FCM project ID when configured", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        fcmProjectId: "firebase-project-456",
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

    it("should fallback to legacy apnsUsesSandboxCert when apnsUseSandboxEndpoint is not present", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        apnsAuthType: "certificate",
        // Legacy field only (for backwards compatibility)
        apnsUsesSandboxCert: true,
        // New field is undefined
      });

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Sandbox");
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
