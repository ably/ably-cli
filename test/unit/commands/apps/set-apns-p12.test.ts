import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DEFAULT_TEST_CONFIG } from "../../../helpers/mock-config-manager.js";

describe("apps:set-apns-p12 command", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;
  let testTempDir: string;
  let testCertFile: string;

  beforeEach(() => {
    // Create temp directory for test certificate file
    testTempDir = resolve(tmpdir(), `ably-cli-test-apns-p12-${Date.now()}`);
    mkdirSync(testTempDir, { recursive: true, mode: 0o700 });

    // Create a fake certificate file
    testCertFile = resolve(testTempDir, "test-cert.p12");
    writeFileSync(testCertFile, "fake-certificate-data");
  });

  afterEach(() => {
    nock.cleanAll();

    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true });
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
