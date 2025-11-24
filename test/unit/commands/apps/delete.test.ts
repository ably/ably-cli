import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "node:path";
import { tmpdir } from "os";

describe("apps:delete command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockAppName = "TestApp";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    // Set environment variable for access token
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    // Create a temporary config directory for testing
    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    // Create a minimal config file with a default account
    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    // Clean up nock interceptors
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;
    process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
  });

  describe("successful app deletion", () => {
    it("should delete app successfully with --force flag", async () => {
      // Mock the /me endpoint for getApp (listApps)
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint for getApp
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock the app deletion endpoint
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("App deleted successfully");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockApp = {
        id: mockAppId,
        accountId: mockAccountId,
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
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint for getApp
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [mockApp]);

      // Mock the app deletion endpoint
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["apps:delete", mockAppId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", mockAppId);
      expect(result.app).toHaveProperty("name", mockAppName);
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";

      // Mock the /me endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
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
        .delete(`/v1/apps/${mockAppId}`)
        .reply(204);

      const { stdout } = await runCommand(
        [
          "apps:delete",
          mockAppId,
          "--force",
          "--access-token",
          "custom_access_token",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("App deleted successfully");
    });
  });

  // describe('confirmation prompts', () => {
  //   // NOTE: These tests are skipped because interactive stdin tests cause timeouts in CI
  //   // TODO: Fix readline mocking to make these tests work reliably
  //   // These tests use stdin() which is not compatible with runCommand and are already skipped
  //   // They would need to be reimplemented with a different approach when stdin testing is fixed

  //   /* SKIPPED - Interactive stdin tests - See: https://github.com/ably/cli/issues/70
  //   it.skip('should proceed with deletion when user confirms', async () => {
  //     // Would need stdin mocking approach
  //   });

  //   it.skip('should cancel deletion when app name doesnt match', async () => {
  //     // Would need stdin mocking approach
  //   });

  //   it.skip('should cancel deletion when user responds no to confirmation', async () => {
  //     // Would need stdin mocking approach
  //   });
  //   */
  // });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock authentication failure
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle app not found error", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock app not found
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { error } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/not found/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle deletion API error", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock deletion failure
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle missing app ID when no current app is set", async () => {
      const { error } = await runCommand(["apps:delete"], import.meta.url);
      expect(error).toBeDefined();
      expect(error.message).toMatch(
        /No app ID provided and no current app selected/,
      );
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle errors in JSON format when --json flag is used", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock deletion failure
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:delete", mockAppId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("status", "error");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("appId", mockAppId);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock forbidden error
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 409 conflict error when app has dependencies", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: Date.now(),
            modified: Date.now(),
            tlsOnly: false,
          },
        ]);

      // Mock conflict error (app has dependencies)
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}`)
        .reply(409, {
          error: "Conflict",
          details: "App has active resources that must be deleted first",
        });

      const { error } = await runCommand(
        ["apps:delete", mockAppId, "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/409/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("current app handling", () => {
    it("should use current app when no app ID provided", async () => {
      // Set environment variable for current app
      const originalAppId = process.env.ABLY_APP_ID;
      process.env.ABLY_APP_ID = mockAppId;

      try {
        // Mock the /me endpoint
        nock("https://control.ably.net")
          .get("/v1/me")
          .reply(200, {
            account: { id: mockAccountId, name: "Test Account" },
            user: { email: "test@example.com" },
          });

        // Mock the app listing endpoint for getApp
        nock("https://control.ably.net")
          .get(`/v1/accounts/${mockAccountId}/apps`)
          .reply(200, [
            {
              id: mockAppId,
              accountId: mockAccountId,
              name: mockAppName,
              status: "active",
              created: Date.now(),
              modified: Date.now(),
              tlsOnly: false,
            },
          ]);

        // Mock the app deletion endpoint
        nock("https://control.ably.net")
          .delete(`/v1/apps/${mockAppId}`)
          .reply(204);

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
