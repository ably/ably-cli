import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("apps:update command", () => {
  const mockAppName = "TestApp";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful app update", () => {
    it("should update an app name successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`, {
          name: updatedName,
        })
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain(appId);
      expect(stdout).toContain(updatedName);
    });

    it("should update TLS only flag successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`, {
          tlsOnly: true,
        })
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should update both name and TLS only successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`, {
          name: updatedName,
          tlsOnly: true,
        })
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain(updatedName);
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      const mockApp = {
        id: appId,
        accountId: accountId,
        name: updatedName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
      };

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(200, mockApp);

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", appId);
      expect(result.app).toHaveProperty("name", updatedName);
      expect(result).toHaveProperty("success", true);
    });

    it("should use custom access token when provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;
      const customToken = "custom_access_token";
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .patch(`/v1/apps/${appId}`)
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        [
          "apps:update",
          appId,
          "--name",
          updatedName,
          "--access-token",
          customToken,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
    });
  });

  describe("error handling", () => {
    it("should require at least one update parameter", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      const { error } = await runCommand(
        ["apps:update", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/At least one update parameter/);
    });

    it("should handle JSON error output when no update parameter provided", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      const { stdout } = await runCommand(
        ["apps:update", appId, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/At least one update parameter/);
    });

    it("should require app ID argument", async () => {
      const { error } = await runCommand(
        ["apps:update", "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/i);
    });

    it("should handle 401 authentication error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock authentication failure
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should handle 403 forbidden error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock forbidden response
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
    });

    it("should handle 404 not found error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock not found response
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(404, { error: "Not Found" });

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
    });

    it("should handle 500 server error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock server error
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
    });

    it("should handle network errors", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock network error
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
    });

    it("should handle JSON error output for API errors", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock server error
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", "NewName", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("appId", appId);
    });
  });

  describe("output formatting", () => {
    it("should display APNS sandbox cert status when available", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;

      // Mock the app update endpoint with APNS cert info
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        accountId: accountId,
        name: mockAppName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
        apnsUsesSandboxCert: true,
      });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", mockAppName],
        import.meta.url,
      );

      expect(stdout).toContain("APNS Uses Sandbox Cert: Yes");
    });

    it("should include APNS info in JSON output when available", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const appId = mock.getCurrentAppId()!;

      // Mock the app update endpoint with APNS cert info
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        accountId: accountId,
        name: mockAppName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
        apnsUsesSandboxCert: false,
      });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", mockAppName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.app).toHaveProperty("apnsUsesSandboxCert", false);
    });
  });
});
