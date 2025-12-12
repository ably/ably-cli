import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("apps:update command", () => {
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

    // Restore original config directory
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    // Clean up test config directory
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("successful app update", () => {
    it("should update an app name successfully", async () => {
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`, {
          name: updatedName,
        })
        .reply(200, {
          id: mockAppId,
          accountId: mockAccountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--name", updatedName],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain(mockAppId);
      expect(stdout).toContain(updatedName);
    });

    it("should update TLS only flag successfully", async () => {
      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`, {
          tlsOnly: true,
        })
        .reply(200, {
          id: mockAppId,
          accountId: mockAccountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should update both name and TLS only successfully", async () => {
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`, {
          name: updatedName,
          tlsOnly: true,
        })
        .reply(200, {
          id: mockAppId,
          accountId: mockAccountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--name", updatedName, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain(updatedName);
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should output JSON format when --json flag is used", async () => {
      const updatedName = "UpdatedAppName";
      const mockApp = {
        id: mockAppId,
        accountId: mockAccountId,
        name: updatedName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
      };

      // Mock the app update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(200, mockApp);

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--name", updatedName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", mockAppId);
      expect(result.app).toHaveProperty("name", updatedName);
      expect(result).toHaveProperty("success", true);
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .patch(`/v1/apps/${mockAppId}`)
        .reply(200, {
          id: mockAppId,
          accountId: mockAccountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        [
          "apps:update",
          mockAppId,
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
      const { error } = await runCommand(
        ["apps:update", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/At least one update parameter/);
    });

    it("should handle JSON error output when no update parameter provided", async () => {
      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--json"],
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
      // Mock authentication failure
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:update", mockAppId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock forbidden response
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:update", mockAppId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
    });

    it("should handle 404 not found error", async () => {
      // Mock not found response
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(404, { error: "Not Found" });

      const { error } = await runCommand(
        ["apps:update", mockAppId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
    });

    it("should handle 500 server error", async () => {
      // Mock server error
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["apps:update", mockAppId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:update", mockAppId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
    });

    it("should handle JSON error output for API errors", async () => {
      // Mock server error
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--name", "NewName", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("appId", mockAppId);
    });
  });

  describe("output formatting", () => {
    it("should display APNS sandbox cert status when available", async () => {
      // Mock the app update endpoint with APNS cert info
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(200, {
          id: mockAppId,
          accountId: mockAccountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
          apnsUsesSandboxCert: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--name", mockAppName],
        import.meta.url,
      );

      expect(stdout).toContain("APNS Uses Sandbox Cert: Yes");
    });

    it("should include APNS info in JSON output when available", async () => {
      // Mock the app update endpoint with APNS cert info
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}`)
        .reply(200, {
          id: mockAppId,
          accountId: mockAccountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
          apnsUsesSandboxCert: false,
        });

      const { stdout } = await runCommand(
        ["apps:update", mockAppId, "--name", mockAppName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.app).toHaveProperty("apnsUsesSandboxCert", false);
    });
  });
});
