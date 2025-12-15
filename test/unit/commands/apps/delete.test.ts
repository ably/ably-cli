import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("apps:delete command", () => {
  const mockAppName = "TestApp";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful app deletion", () => {
    it("should delete app successfully with --force flag", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint for getApp (listApps)
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint for getApp
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: accountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock the app deletion endpoint
      nock("https://control.ably.net").delete(`/v1/apps/${appId}`).reply(204);

      const { stdout } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("App deleted successfully");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      const mockApp = {
        id: appId,
        accountId: accountId,
        name: mockAppName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
      };

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint for getApp
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [mockApp]);

      // Mock the app deletion endpoint
      nock("https://control.ably.net").delete(`/v1/apps/${appId}`).reply(204);

      const { stdout } = await runCommand(
        ["apps:delete", appId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", appId);
      expect(result.app).toHaveProperty("name", mockAppName);
    });

    it("should use custom access token when provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;
      const customToken = "custom_access_token";

      // Mock the /me endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: accountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock the app deletion endpoint
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .delete(`/v1/apps/${appId}`)
        .reply(204);

      const { stdout } = await runCommand(
        [
          "apps:delete",
          appId,
          "--force",
          "--access-token",
          "custom_access_token",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("App deleted successfully");
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock authentication failure
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle app not found error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock app not found
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, []);

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/not found/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle deletion API error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: accountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock deletion failure
      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle missing app ID when no current app is set", async () => {
      // Clear the current app from mock config
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

      const { error } = await runCommand(["apps:delete"], import.meta.url);
      expect(error).toBeDefined();
      expect(error.message).toMatch(
        /No app ID provided and no current app selected/,
      );
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock network error
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle errors in JSON format when --json flag is used", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: accountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock deletion failure
      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:delete", appId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("status", "error");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("appId", appId);
    });

    it("should handle 403 forbidden error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: accountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock forbidden error
      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 409 conflict error when app has dependencies", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: accountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock conflict error (app has dependencies)
      nock("https://control.ably.net").delete(`/v1/apps/${appId}`).reply(409, {
        error: "Conflict",
        details: "App has active resources that must be deleted first",
      });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/409/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("current app handling", () => {
    it("should use current app when no app ID provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Set environment variable for current app
      const originalAppId = process.env.ABLY_APP_ID;
      process.env.ABLY_APP_ID = appId;

      try {
        // Mock the /me endpoint
        nock("https://control.ably.net")
          .get("/v1/me")
          .reply(200, {
            account: { id: accountId, name: accountName },
            user: { email: userEmail },
          });

        // Mock the app listing endpoint for getApp
        nock("https://control.ably.net")
          .get(`/v1/accounts/${accountId}/apps`)
          .reply(200, [
            {
              id: appId,
              accountId: accountId,
              name: mockAppName,
              status: "active",
              created: Date.now(),
              modified: Date.now(),
              tlsOnly: false,
            },
          ]);

        // Mock the app deletion endpoint
        nock("https://control.ably.net").delete(`/v1/apps/${appId}`).reply(204);

        const { stdout } = await runCommand(
          ["apps:delete", "--force"],
          import.meta.url,
        );

        expect(stdout).toContain("App deleted successfully");
      } finally {
        // Restore original environment variable
        if (originalAppId) {
          process.env.ABLY_APP_ID = originalAppId;
        } else {
          delete process.env.ABLY_APP_ID;
        }
      }
    });
  });
});
