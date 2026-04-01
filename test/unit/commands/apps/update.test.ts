import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
  CONTROL_HOST,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";

describe("apps:update command", () => {
  const mockAppName = "TestApp";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  describe("functionality", () => {
    it("should update an app name successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint
      nockControl()
        .patch(`/v1/apps/${appId}`, {
          name: updatedName,
        })
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain(appId);
      expect(stdout).toContain(updatedName);
    });

    it("should update TLS only flag successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;

      // Mock the app update endpoint
      nockControl()
        .patch(`/v1/apps/${appId}`, {
          tlsOnly: true,
        })
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should update both name and TLS only successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      // Mock the app update endpoint
      nockControl()
        .patch(`/v1/apps/${appId}`, {
          name: updatedName,
          tlsOnly: true,
        })
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
      expect(stdout).toContain(updatedName);
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      const mockApp = {
        id: appId,
        accountId: accountId,
        name: updatedName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
      };

      // Mock the app update endpoint
      nockControl().patch(`/v1/apps/${appId}`).reply(200, mockApp);

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "apps:update");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", appId);
      expect(result.app).toHaveProperty("name", updatedName);
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const customToken = "custom_access_token";
      const updatedName = "UpdatedAppName";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      // Mock the app update endpoint with custom token
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .patch(`/v1/apps/${appId}`)
        .reply(200, {
          id: appId,
          accountId: accountId,
          name: updatedName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName],
        import.meta.url,
      );

      expect(stdout).toContain("App updated successfully");
    });
  });

  standardHelpTests("apps:update", import.meta.url);
  standardArgValidationTests("apps:update", import.meta.url, {
    requiredArgs: ["test-app-id"],
  });
  standardFlagTests("apps:update", import.meta.url, ["--json"]);

  describe("error handling", () => {
    standardControlApiErrorTests({
      get commandArgs() {
        return [
          "apps:update",
          getMockConfigManager().getCurrentAppId()!,
          "--name",
          "NewName",
        ];
      },
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        if (scenario === "401") {
          nockControl()
            .patch(`/v1/apps/${appId}`)
            .reply(401, { error: "Unauthorized" });
        } else if (scenario === "500") {
          nockControl()
            .patch(`/v1/apps/${appId}`)
            .reply(500, { error: "Internal Server Error" });
        } else {
          nockControl()
            .patch(`/v1/apps/${appId}`)
            .replyWithError("Network error");
        }
      },
    });

    it("should require at least one update parameter", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      const { error } = await runCommand(
        ["apps:update", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/At least one update parameter/);
    });

    it("should handle JSON error output when no update parameter provided", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      const { stdout } = await runCommand(
        ["apps:update", appId, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "apps:update");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toMatch(/At least one update parameter/);
    });

    it("should require app ID argument", async () => {
      const { error } = await runCommand(
        ["apps:update", "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/i);
    });

    it("should handle 403 forbidden error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock forbidden response
      nockControl()
        .patch(`/v1/apps/${appId}`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
    });

    it("should handle 404 not found error", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock not found response
      nockControl()
        .patch(`/v1/apps/${appId}`)
        .reply(404, { error: "Not Found" });

      const { error } = await runCommand(
        ["apps:update", appId, "--name", "NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
    });

    it("should handle JSON error output for API errors", async () => {
      const mock = getMockConfigManager();
      const appId = mock.getCurrentAppId()!;

      // Mock server error
      nockControl()
        .patch(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", "NewName", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "apps:update");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("appId", appId);
    });
  });

  describe("output formatting", () => {
    it("should display APNS sandbox cert status when available", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;

      // Mock the app update endpoint with APNS cert info
      nockControl().patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        accountId: accountId,
        name: mockAppName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
        apnsUsesSandboxCert: true,
      });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", mockAppName],
        import.meta.url,
      );

      expect(stdout).toContain("APNS Uses Sandbox Cert: Yes");
    });

    it("should include APNS info in JSON output when available", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;

      // Mock the app update endpoint with APNS cert info
      nockControl().patch(`/v1/apps/${appId}`).reply(200, {
        id: appId,
        accountId: accountId,
        name: mockAppName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
        apnsUsesSandboxCert: false,
      });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", mockAppName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "apps:update");
      expect(result).toHaveProperty("success", true);
      expect(result.app).toHaveProperty("apnsUsesSandboxCert", false);
    });
  });
});
