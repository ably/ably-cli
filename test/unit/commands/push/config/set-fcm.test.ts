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

      const { stderr } = await runCommand(
        ["push:config:set-fcm", "--service-account", fcmFixturePath],
        import.meta.url,
      );

      expect(stderr).toContain("FCM configuration updated");
    });

    it("should output JSON when requested", async () => {
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:set-fcm", "--service-account", fcmFixturePath, "--json"],
        import.meta.url,
      );

      // Parse NDJSON output — find the result record
      const records = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
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
      const tempDir = mkdtempSync(join(tmpdir(), "ably-cli-test-"));
      const tempPath = join(tempDir, "invalid.json");
      writeFileSync(tempPath, "not valid json content");
      try {
        const { error } = await runCommand(
          ["push:config:set-fcm", "--service-account", tempPath],
          import.meta.url,
        );
        expect(error).toBeDefined();
        expect(error?.message).toContain("not valid JSON");
      } finally {
        unlinkSync(tempPath);
        rmdirSync(tempDir);
      }
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

  describe("file extension validation", () => {
    it("should reject service account files without .json extension", async () => {
      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", "/etc/passwd"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid service account file type");
      expect(error?.message).toContain(".json");
    });
  });

  describe("web CLI restrictions", () => {
    let originalWebCliMode: string | undefined;

    beforeEach(() => {
      originalWebCliMode = process.env.ABLY_WEB_CLI_MODE;
    });

    afterEach(() => {
      if (originalWebCliMode === undefined) {
        delete process.env.ABLY_WEB_CLI_MODE;
      } else {
        process.env.ABLY_WEB_CLI_MODE = originalWebCliMode;
      }
    });

    it("should be restricted in web CLI mode", async () => {
      process.env.ABLY_WEB_CLI_MODE = "true";

      const { error } = await runCommand(
        ["push:config:set-fcm", "--service-account", fcmFixturePath],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not available in the web CLI");
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
