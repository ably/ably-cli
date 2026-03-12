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

describe("push:config:clear-apns command", () => {
  let appId: string;

  beforeEach(() => {
    const ctx = getControlApiContext();
    appId = ctx.appId;
    process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  standardHelpTests("push:config:clear-apns", import.meta.url);
  standardArgValidationTests("push:config:clear-apns", import.meta.url);
  standardFlagTests("push:config:clear-apns", import.meta.url, [
    "--json",
    "--app",
    "--force",
  ]);

  describe("functionality", () => {
    it("should clear APNs config with --force", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: "test-account", name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/test-account/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: "test-account",
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
            apnsCertificate: "some-cert",
          },
        ]);
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("APNs configuration cleared");
    });

    it("should warn when APNs is not configured", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: "test-account", name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/test-account/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: "test-account",
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("not configured");
      expect(stdout).toContain("Nothing to clear");
    });

    it("should output JSON when requested", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: "test-account", name: "Test" },
          user: { email: "test@test.com" },
        });
      nockControl()
        .get(`/v1/accounts/test-account/apps`)
        .reply(200, [
          {
            id: appId,
            accountId: "test-account",
            name: "Test App",
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
            apnsSigningKey: "some-key",
          },
        ]);
      nockControl().patch(`/v1/apps/${appId}`).reply(200, { id: appId });

      const { stdout } = await runCommand(
        ["push:config:clear-apns", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("cleared", "apns");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["push:config:clear-apns", "--force"],
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
