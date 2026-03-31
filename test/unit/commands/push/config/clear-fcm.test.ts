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

describe("push:config:clear-fcm command", () => {
  let appId: string;
  let accountId: string;

  beforeEach(() => {
    const ctx = getControlApiContext();
    appId = ctx.appId;
    accountId = ctx.accountId;
    process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  standardHelpTests("push:config:clear-fcm", import.meta.url);
  standardArgValidationTests("push:config:clear-fcm", import.meta.url);
  standardFlagTests("push:config:clear-fcm", import.meta.url, [
    "--json",
    "--app",
    "--force",
  ]);

  describe("functionality", () => {
    it("should clear FCM config with --force", async () => {
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
            fcmServiceAccountConfigured: true,
          },
        ]);
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:clear-fcm", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("FCM configuration cleared");
    });

    it("should warn when FCM is not configured", async () => {
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
        ["push:config:clear-fcm", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("not configured");
      expect(stdout).toContain("Nothing to clear");
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
            fcmServiceAccountConfigured: true,
          },
        ]);
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:clear-fcm", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("config");
      expect(result.config).toHaveProperty("cleared", "fcm");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["push:config:clear-fcm", "--force"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        switch (scenario) {
          case "401": {
            nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

            break;
          }
          case "500": {
            nockControl().get("/v1/me").reply(500, { error: "Server Error" });

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
  });
});
