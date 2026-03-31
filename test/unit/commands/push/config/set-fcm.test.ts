import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve, join } from "node:path";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  nockControl,
  controlApiCleanup,
  getControlApiContext,
} from "../../../../helpers/control-api-test-helpers.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../../helpers/standard-tests.js";

describe("push:config:set-fcm command", () => {
  let appId: string;
  const fcmFixturePath = resolve(
    "test/fixtures/push/test-fcm-service-account.json",
  );

  beforeEach(() => {
    const ctx = getControlApiContext();
    appId = ctx.appId;
    process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  standardHelpTests("push:config:set-fcm", import.meta.url);
  standardArgValidationTests("push:config:set-fcm", import.meta.url);
  standardFlagTests("push:config:set-fcm", import.meta.url, [
    "--json",
    "--app",
    "--service-account",
  ]);

  describe("functionality", () => {
    it("should configure FCM successfully", async () => {
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:set-fcm", "--service-account", fcmFixturePath],
        import.meta.url,
      );

      expect(stdout).toContain("FCM configuration updated");
    });

    it("should output JSON when requested", async () => {
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:set-fcm", "--service-account", fcmFixturePath, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("config");
      expect(result.config).toHaveProperty("appId");
      expect(result.config).toHaveProperty("provider", "fcm");
    });

    it("should fail when service account file not found", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", "/nonexistent/file.json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should fail when service account file is not valid JSON", async () => {
      const invalidPath = resolve("test/fixtures/push/test-apns-key.p8");
      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", invalidPath],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require service-account flag", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject service account without type service_account", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "ably-cli-test-"));
      const tempPath = join(tempDir, "wrong-type.json");
      writeFileSync(
        tempPath,
        JSON.stringify({ type: "not_service_account", project_id: "test" }),
      );
      try {
        const { error } = await runCommand(
          ["push:config:set-fcm", "--service-account", tempPath],
          import.meta.url,
        );
        expect(error).toBeDefined();
      } finally {
        unlinkSync(tempPath);
        rmdirSync(tempDir);
      }
    });

    it("should reject service account without project_id", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "ably-cli-test-"));
      const tempPath = join(tempDir, "no-project.json");
      writeFileSync(tempPath, JSON.stringify({ type: "service_account" }));
      try {
        const { error } = await runCommand(
          ["push:config:set-fcm", "--service-account", tempPath],
          import.meta.url,
        );
        expect(error).toBeDefined();
      } finally {
        unlinkSync(tempPath);
        rmdirSync(tempDir);
      }
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["push:config:set-fcm", "--service-account", fcmFixturePath],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        switch (scenario) {
          case "401": {
            nockControl()
              .patch(`/v1/apps/${appId}`)
              .reply(401, { error: "Unauthorized" });

            break;
          }
          case "500": {
            nockControl()
              .patch(`/v1/apps/${appId}`)
              .reply(500, { error: "Server Error" });

            break;
          }
          case "network": {
            nockControl()
              .patch(`/v1/apps/${appId}`)
              .replyWithError("Network error");

            break;
          }
          // No default
        }
      },
    });
  });
});
