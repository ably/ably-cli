import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
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
import { parseJsonOutput } from "../../../../helpers/ndjson.js";

describe("push:config:set-apns command", () => {
  let appId: string;
  const p8FixturePath = resolve("test/fixtures/push/test-apns-key.p8");
  const p12FixturePath = resolve("test/fixtures/push/test-apns-cert.p12");

  beforeEach(() => {
    const ctx = getControlApiContext();
    appId = ctx.appId;
    process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  standardHelpTests("push:config:set-apns", import.meta.url);
  standardArgValidationTests("push:config:set-apns", import.meta.url);
  standardFlagTests("push:config:set-apns", import.meta.url, [
    "--json",
    "--app",
    "--certificate",
    "--key-file",
    "--sandbox",
  ]);

  describe("functionality", () => {
    it("should configure APNs with P8 key successfully", async () => {
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stderr } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          p8FixturePath,
          "--key-id",
          "KEY123",
          "--team-id",
          "TEAM456",
          "--topic",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("APNs P8 key configured");
    });

    it("should upload P12 certificate successfully", async () => {
      nockControl()
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, { id: "cert-123" });

      const { stderr } = await runCommand(
        ["push:config:set-apns", "--certificate", p12FixturePath],
        import.meta.url,
      );

      expect(stderr).toContain("APNs P12 certificate uploaded");
    });

    it("should output JSON for P8 key when requested", async () => {
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          p8FixturePath,
          "--key-id",
          "KEY123",
          "--team-id",
          "TEAM456",
          "--topic",
          "com.example.app",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("config");
      expect(result.config).toHaveProperty("method", "p8");
    });

    it("should output JSON for P12 certificate when requested", async () => {
      nockControl()
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, { id: "cert-123" });

      const { stdout } = await runCommand(
        ["push:config:set-apns", "--certificate", p12FixturePath, "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("config");
      expect(result.config).toHaveProperty("method", "p12");
    });

    it("should require either certificate or key-file", async () => {
      const { error } = await runCommand(
        ["push:config:set-apns"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require key-id when using key-file", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          p8FixturePath,
          "--team-id",
          "TEAM456",
          "--topic",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require team-id when using key-file", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          p8FixturePath,
          "--key-id",
          "KEY123",
          "--topic",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require topic when using key-file", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          p8FixturePath,
          "--key-id",
          "KEY123",
          "--team-id",
          "TEAM456",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should fail when key file not found", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          "/nonexistent/file.p8",
          "--key-id",
          "KEY123",
          "--team-id",
          "TEAM456",
          "--topic",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should upload P12 certificate with --sandbox and PATCH sandbox flag", async () => {
      nockControl()
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, { id: "cert-123" });
      nockControl()
        .patch(`/v1/apps/${appId}`)
        .reply(200, { id: appId, apnsUseSandboxEndpoint: true });

      const { stderr } = await runCommand(
        ["push:config:set-apns", "--certificate", p12FixturePath, "--sandbox"],
        import.meta.url,
      );

      expect(stderr).toContain("APNs P12 certificate uploaded");
    });

    it("should fail when certificate file not found", async () => {
      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", "/nonexistent/cert.p12"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  describe("file extension validation", () => {
    it("should reject certificate files without .p12 or .pfx extension", async () => {
      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", "/etc/passwd"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid certificate file type");
      expect(error?.message).toContain(".p12 or .pfx");
    });

    it("should reject key files without .p8 extension", async () => {
      const { error } = await runCommand(
        [
          "push:config:set-apns",
          "--key-file",
          "/some/file.txt",
          "--key-id",
          "KEY123",
          "--team-id",
          "TEAM456",
          "--topic",
          "com.example.app",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid key file type");
      expect(error?.message).toContain(".p8");
    });

    it("should accept .pfx certificate files", async () => {
      nockControl()
        .post(`/v1/apps/${appId}/pkcs12`)
        .reply(200, { id: "cert-123" });

      // The file won't exist, but extension validation should pass
      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", "/nonexistent/cert.pfx"],
        import.meta.url,
      );

      // Should fail with "not found", not "invalid file type"
      expect(error).toBeDefined();
      expect(error?.message).toContain("not found");
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
        ["push:config:set-apns", "--certificate", p12FixturePath],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not available in the web CLI");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: [
        "push:config:set-apns",
        "--key-file",
        p8FixturePath,
        "--key-id",
        "KEY123",
        "--team-id",
        "TEAM456",
        "--topic",
        "com.example.app",
      ],
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
