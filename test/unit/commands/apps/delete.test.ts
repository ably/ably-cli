import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
  CONTROL_HOST,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("apps:delete command", () => {
  const mockAppName = "TestApp";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  describe("functionality", () => {
    it("should delete app successfully with --force flag", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint for getApp (listApps)
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint for getApp
      nockControl()
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
      nockControl().delete(`/v1/apps/${appId}`).reply(204);

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
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint for getApp
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, [mockApp]);

      // Mock the app deletion endpoint
      nockControl().delete(`/v1/apps/${appId}`).reply(204);

      const { stdout } = await runCommand(
        ["apps:delete", appId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "apps:delete");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", appId);
      expect(result.app).toHaveProperty("name", mockAppName);
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;
      const customToken = "custom_access_token";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      // Mock the /me endpoint with custom token
      nock(CONTROL_HOST, {
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
      nock(CONTROL_HOST, {
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
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .delete(`/v1/apps/${appId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("App deleted successfully");
    });
  });

  standardHelpTests("apps:delete", import.meta.url);

  describe("argument validation", () => {
    it("should handle missing app ID when no current app is set", async () => {
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

      const { error } = await runCommand(["apps:delete"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /No app ID provided and no current app selected/,
      );
    });
  });

  standardFlagTests("apps:delete", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock authentication failure
      nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle app not found error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock app not found
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, []);

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/not found/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle deletion API error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nockControl()
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
      nockControl()
        .delete(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle missing app ID when no current app is set", async () => {
      // Clear the current app from mock config
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

      const { error } = await runCommand(["apps:delete"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /No app ID provided and no current app selected/,
      );
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock network error
      nockControl().get("/v1/me").replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle errors in JSON format when --json flag is used", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nockControl()
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
      nockControl()
        .delete(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:delete", appId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "apps:delete");
      expect(result).toHaveProperty("success", false);
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
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nockControl()
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
      nockControl()
        .delete(`/v1/apps/${appId}`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 409 conflict error when app has dependencies", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const appId = mock.getCurrentAppId()!;

      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app listing endpoint
      nockControl()
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
      nockControl().delete(`/v1/apps/${appId}`).reply(409, {
        error: "Conflict",
        details: "App has active resources that must be deleted first",
      });

      const { error } = await runCommand(
        ["apps:delete", appId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/409/);
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
        nockControl()
          .get("/v1/me")
          .reply(200, {
            account: { id: accountId, name: accountName },
            user: { email: userEmail },
          });

        // Mock the app listing endpoint for getApp
        nockControl()
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
        nockControl().delete(`/v1/apps/${appId}`).reply(204);

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
