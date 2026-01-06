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

describe("push:config:clear-fcm command", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("when FCM is configured", () => {
    it("should clear FCM configuration with --force flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        fcmServiceAccount: "{ ... }",
        fcmProjectId: "test-project",
      });

      // Mock updateApp to clear FCM
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        ["push:config:clear-fcm", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("FCM configuration removed successfully");
    });

    it("should output JSON when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        fcmServiceAccount: "{ ... }",
        fcmProjectId: "test-project",
      });

      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        ["push:config:clear-fcm", "--force", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.message).toBe("FCM configuration cleared");
    });
  });

  describe("when FCM is not configured", () => {
    it("should report that FCM is not configured", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        // No FCM configuration
      });

      const { stdout } = await runCommand(
        ["push:config:clear-fcm", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("FCM is not configured");
    });
  });

  describe("error handling", () => {
    it("should handle API errors when getting app", async () => {
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
        .reply(500, { error: "Internal server error" });

      const { error } = await runCommand(
        ["push:config:clear-fcm", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/500/);
    });

    it("should handle API errors when clearing FCM", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId, {
        fcmServiceAccount: "{ ... }",
        fcmProjectId: "test-project",
      });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(400, { error: "Bad request" });

      const { error } = await runCommand(
        ["push:config:clear-fcm", "--force"],
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
        ["push:config:clear-fcm", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
