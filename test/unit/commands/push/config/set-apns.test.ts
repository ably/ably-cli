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

describe("push:config:set-apns command", () => {
  let appId: string;
  const p8FixturePath = resolve("test/fixtures/push/test-apns-key.p8");

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
        ],
        import.meta.url,
      );

      expect(stdout).toContain("APNs P8 key configured");
    });

    it("should upload P12 certificate successfully", async () => {
      nockControl()
        .post(`/v1/apps/${appId}/push/certificate`)
        .reply(200, { id: "cert-123" });

      const { stdout } = await runCommand(
        ["push:config:set-apns", "--certificate", p8FixturePath],
        import.meta.url,
      );

      expect(stdout).toContain("APNs P12 certificate uploaded");
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

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("method", "p8");
    });

    it("should output JSON for P12 certificate when requested", async () => {
      nockControl()
        .post(`/v1/apps/${appId}/push/certificate`)
        .reply(200, { id: "cert-123" });

      const { stdout } = await runCommand(
        ["push:config:set-apns", "--certificate", p8FixturePath, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("method", "p12");
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

    it("should fail when certificate file not found", async () => {
      const { error } = await runCommand(
        ["push:config:set-apns", "--certificate", "/nonexistent/cert.p12"],
        import.meta.url,
      );

      expect(error).toBeDefined();
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
