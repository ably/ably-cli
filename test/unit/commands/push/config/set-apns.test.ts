import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

// Helper to set up common mocks for Control API
function setupControlApiMocks(appId: string) {
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
      },
    ]);
}

describe("push:config:set-apns command", () => {
  let testTempDir: string;
  let validP12File: string;
  let validP8File: string;

  beforeEach(() => {
    // Create temp directory for test files
    testTempDir = resolve(tmpdir(), `ably-cli-test-apns-${Date.now()}`);
    mkdirSync(testTempDir, { recursive: true, mode: 0o700 });

    // Create mock P12 certificate file (just needs to exist for validation)
    validP12File = resolve(testTempDir, "cert.p12");
    writeFileSync(validP12File, Buffer.from("mock p12 certificate data"));

    // Create mock P8 key file
    validP8File = resolve(testTempDir, "AuthKey.p8");
    writeFileSync(
      validP8File,
      "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgtest\n-----END PRIVATE KEY-----\n",
    );
  });

  afterEach(() => {
    nock.cleanAll();

    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true });
    }
  });

  describe("certificate-based authentication (P12)", () => {
    it("should configure APNs with P12 certificate", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, {
          id: "cert-123",
        });

      const { stdout } = await runCommand(
        ["push:config:set-apns", "--certificate", validP12File],
        import.meta.url,
      );

      expect(stdout).toContain("APNs P12 certificate uploaded successfully");
    });

    it("should configure APNs with P12 certificate and password", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, {
          id: "cert-456",
        });

      const { stdout } = await runCommand(
        [
          "push:config:set-apns",
          "--certificate",
          validP12File,
          "--password",
          "secret123",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("APNs P12 certificate uploaded successfully");
    });

    it("should output JSON when --json flag is used with P12", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, {
          id: "cert-789",
        });

      const { stdout } = await runCommand(
        ["push:config:set-apns", "--certificate", validP12File, "--json"],
        import.meta.url,
      );

      // Extract JSON from output (command may log progress messages)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();
      const output = JSON.parse(jsonMatch![0]);
      expect(output.success).toBe(true);
      expect(output.authType).toBe("certificate");
      expect(output.certificateId).toBe("cert-789");
    });
  });

  describe("token-based authentication (P8)", () => {
    it("should configure APNs with token-based auth", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          validP8File,
          "--key-id",
          "ABC123XYZ",
          "--team-id",
          "TEAMID123",
          "--bundle-id",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(
        "APNs token-based authentication configured successfully",
      );
    });

    it("should output JSON when --json flag is used with P8", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          validP8File,
          "--key-id",
          "ABC123XYZ",
          "--team-id",
          "TEAMID123",
          "--bundle-id",
          "com.example.app",
          "--json",
        ],
        import.meta.url,
      );

      // Extract JSON from output (command may log progress messages)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();
      const output = JSON.parse(jsonMatch![0]);
      expect(output.success).toBe(true);
      expect(output.authType).toBe("token");
      expect(output.keyId).toBe("ABC123XYZ");
      expect(output.teamId).toBe("TEAMID123");
      expect(output.bundleId).toBe("com.example.app");
    });
  });

  describe("validation", () => {
    it("should require either --certificate or --key-file", async () => {
      const { error } = await runCommand(
        ["push:config:set-apns"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/--certificate.*--key-file.*must be/i);
    });

    it("should not allow both --certificate and --key-file", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--certificate",
          validP12File,
          "--key-file",
          validP8File,
          "--key-id",
          "ABC123",
          "--team-id",
          "TEAM123",
          "--bundle-id",
          "com.example",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/cannot use both/i);
    });

    it("should require all token auth params when using --key-file", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          validP8File,
          "--key-id",
          "ABC123",
          // Missing --team-id and --bundle-id
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
        /--key-file.*--key-id.*--team-id.*--bundle-id/i,
      );
    });

    it("should error when certificate file does not exist", async () => {
      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", "/nonexistent/cert.p12"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/i);
    });

    it("should error when key file does not exist", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          "/nonexistent/key.p8",
          "--key-id",
          "ABC123",
          "--team-id",
          "TEAM123",
          "--bundle-id",
          "com.example",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/i);
    });
  });

  describe("error handling", () => {
    it("should handle P12 upload API errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(400, { error: "Invalid certificate" });

      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", validP12File],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle token auth API errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(400, { error: "Invalid configuration" });

      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          validP8File,
          "--key-id",
          "ABC123XYZ",
          "--team-id",
          "TEAMID123",
          "--bundle-id",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      setupControlApiMocks(appId);

      // Mock pkcs12 endpoint to return 401
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", validP12File],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
