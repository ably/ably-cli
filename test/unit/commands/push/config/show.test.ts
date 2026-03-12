import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
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

describe("push:config:show command", () => {
  let accountId: string;
  let appId: string;

  beforeEach(() => {
    const ctx = getControlApiContext();
    accountId = ctx.accountId;
    appId = ctx.appId;
    process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  standardHelpTests("push:config:show", import.meta.url);
  standardArgValidationTests("push:config:show", import.meta.url);
  standardFlagTests("push:config:show", import.meta.url, ["--json", "--app"]);

  describe("functionality", () => {
    it("should show push config with not-configured status", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId,
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("APNs Configuration");
      expect(stdout).toContain("FCM Configuration");
      expect(stdout).toContain("Web Push");
      expect(stdout).toContain("Not configured");
      expect(stdout).toContain("Not available");
    });

    it("should show configured APNs P8 key details", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId,
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
            apnsAuthType: "token",
            apnsSigningKey: "some-key",
            apnsSigningKeyId: "KEY123",
            apnsIssuerKey: "TEAM456",
            apnsTopicHeader: "com.example.app",
            apnsUseSandboxEndpoint: true,
          },
        ]);

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Configured");
      expect(stdout).toContain("Sandbox");
      expect(stdout).toContain("P8 Key");
    });

    it("should show configured FCM details", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId,
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
            fcmServiceAccount: "some-account",
            fcmProjectId: "my-project",
          },
        ]);

      const { stdout } = await runCommand(
        ["push:config:show"],
        import.meta.url,
      );

      expect(stdout).toContain("Configured");
      expect(stdout).toContain("my-project");
    });

    it("should output JSON when requested", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [
          {
            id: appId,
            accountId,
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["push:config:show", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("appId");
      expect(result).toHaveProperty("apns");
      expect(result).toHaveProperty("fcm");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["push:config:show"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        switch (scenario) {
          case "401": {
            nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

            break;
          }
          case "500": {
            nockControl()
              .get("/v1/me")
              .reply(200, {
                account: { id: accountId, name: "Test" },
                user: { email: "test@test.com" },
              });
            nockControl()
              .get(`/v1/accounts/${accountId}/apps`)
              .reply(500, { error: "Server Error" });

            break;
          }
          case "network": {
            nockControl().get("/v1/me").replyWithError("Network error");

            break;
          }
          // No default
        }
      },
    });

    it("should handle app not found", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, []);

      const { error } = await runCommand(["push:config:show"], import.meta.url);

      expect(error).toBeDefined();
    });
  });
});
