import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("push:config:set-fcm command", () => {
  let testTempDir: string;
  let validServiceAccountFile: string;
  let invalidTypeFile: string;
  let missingProjectIdFile: string;
  let invalidJsonFile: string;

  beforeEach(() => {
    // Create temp directory for test files
    testTempDir = resolve(tmpdir(), `ably-cli-test-fcm-${Date.now()}`);
    mkdirSync(testTempDir, { recursive: true, mode: 0o700 });

    // Create valid service account file
    validServiceAccountFile = resolve(testTempDir, "valid-sa.json");
    writeFileSync(
      validServiceAccountFile,
      JSON.stringify({
        type: "service_account",
        project_id: "test-project-123",
        private_key_id: "key-id-123",
        private_key:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        client_email:
          "firebase-adminsdk@test-project-123.iam.gserviceaccount.com",
        client_id: "123456789",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
      }),
    );

    // Create file with wrong type
    invalidTypeFile = resolve(testTempDir, "invalid-type.json");
    writeFileSync(
      invalidTypeFile,
      JSON.stringify({
        type: "wrong_type",
        project_id: "test-project",
      }),
    );

    // Create file missing project_id
    missingProjectIdFile = resolve(testTempDir, "missing-project.json");
    writeFileSync(
      missingProjectIdFile,
      JSON.stringify({
        type: "service_account",
      }),
    );

    // Create invalid JSON file
    invalidJsonFile = resolve(testTempDir, "invalid.json");
    writeFileSync(invalidJsonFile, "not valid json {{{");
  });

  afterEach(() => {
    nock.cleanAll();

    if (existsSync(testTempDir)) {
      rmSync(testTempDir, { recursive: true, force: true });
    }
  });

  describe("successful configuration", () => {
    it("should configure FCM with valid service account", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        ["push:config:set-fcm", "--service-account", validServiceAccountFile],
        import.meta.url,
      );

      expect(stdout).toContain("FCM credentials configured successfully");
      expect(stdout).toContain("test-project-123");
    });

    it("should show client email in output", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        ["push:config:set-fcm", "--service-account", validServiceAccountFile],
        import.meta.url,
      );

      expect(stdout).toContain(
        "firebase-adminsdk@test-project-123.iam.gserviceaccount.com",
      );
    });

    it("should output JSON when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net").patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        name: "Test App",
      });

      const { stdout } = await runCommand(
        [
          "push:config:set-fcm",
          "--service-account",
          validServiceAccountFile,
          "--json",
        ],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.projectId).toBe("test-project-123");
      expect(output.clientEmail).toBe(
        "firebase-adminsdk@test-project-123.iam.gserviceaccount.com",
      );
    });
  });

  describe("error handling", () => {
    it("should require service-account flag", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*service-account/);
    });

    it("should error when service account file does not exist", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-fcm",
          "--service-account",
          "/nonexistent/path/sa.json",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/);
    });

    it("should error when file contains invalid JSON", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", invalidJsonFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Invalid JSON/);
    });

    it("should error when service account type is wrong", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", invalidTypeFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/expected.*service_account/);
    });

    it("should error when project_id is missing", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", missingProjectIdFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*project_id/);
    });

    it("should handle API errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(400, { error: "Invalid request" });

      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", validServiceAccountFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", validServiceAccountFile],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
