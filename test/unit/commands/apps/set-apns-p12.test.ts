import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("apps:set-apns-p12 command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  let testConfigDir: string;
  let originalConfigDir: string;
  let testCertFile: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);

    // Create a fake certificate file
    testCertFile = resolve(testConfigDir, "test-cert.p12");
    writeFileSync(testCertFile, "fake-certificate-data");
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("successful certificate upload", () => {
    it("should upload APNS P12 certificate successfully", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/push/certificate`)
        .reply(200, {
          id: "cert-123",
          appId: mockAppId,
        });

      const { stdout } = await runCommand(
        ["apps:set-apns-p12", mockAppId, "--certificate", testCertFile],
        import.meta.url,
      );

      expect(stdout).toContain("APNS P12 certificate uploaded successfully");
    });

    it("should upload certificate with password", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/push/certificate`)
        .reply(200, {
          id: "cert-123",
          appId: mockAppId,
        });

      const { stdout } = await runCommand(
        [
          "apps:set-apns-p12",
          mockAppId,
          "--certificate",
          testCertFile,
          "--password",
          "test-password",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("APNS P12 certificate uploaded successfully");
    });

    it("should upload certificate for sandbox environment", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/push/certificate`)
        .reply(200, {
          id: "cert-123",
          appId: mockAppId,
        });

      const { stdout } = await runCommand(
        [
          "apps:set-apns-p12",
          mockAppId,
          "--certificate",
          testCertFile,
          "--use-for-sandbox",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("APNS P12 certificate uploaded successfully");
      expect(stdout).toContain("Sandbox");
    });
  });

  describe("error handling", () => {
    it("should require app ID argument", async () => {
      const { error } = await runCommand(
        ["apps:set-apns-p12", "--certificate", testCertFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should require certificate flag", async () => {
      const { error } = await runCommand(
        ["apps:set-apns-p12", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*certificate/);
    });

    it("should error when certificate file does not exist", async () => {
      const { error } = await runCommand(
        [
          "apps:set-apns-p12",
          mockAppId,
          "--certificate",
          "/nonexistent/path/cert.p12",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/);
    });

    it("should handle API errors", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/push/certificate`)
        .reply(400, { error: "Invalid certificate" });

      const { error } = await runCommand(
        ["apps:set-apns-p12", mockAppId, "--certificate", testCertFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/push/certificate`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:set-apns-p12", mockAppId, "--certificate", testCertFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
