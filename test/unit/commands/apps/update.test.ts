import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
  mockAppResolution,
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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      const { stdout, stderr } = await runCommand(
        ["apps:update", appId, "--name", updatedName],
        import.meta.url,
      );

      expect(stderr).toContain("App updated successfully");
      expect(stdout).toContain(appId);
      expect(stdout).toContain(updatedName);
    });

    it("should update TLS only flag successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      const { stdout, stderr } = await runCommand(
        ["apps:update", appId, "--tls-only"],
        import.meta.url,
      );

      expect(stderr).toContain("App updated successfully");
      expect(stdout).toContain("TLS Only: Yes");
    });

    it("should update both name and TLS only successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      const { stdout, stderr } = await runCommand(
        ["apps:update", appId, "--name", updatedName, "--tls-only"],
        import.meta.url,
      );

      expect(stderr).toContain("App updated successfully");
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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

      // Mock the app update endpoint
      nockControl().patch(`/v1/apps/${appId}`).reply(200, mockApp);

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", updatedName, "--json"],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      );
      expect(result).toBeDefined();
      expect(result).toHaveProperty("command", "apps:update");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result!.app).toHaveProperty("id", appId);
      expect(result!.app).toHaveProperty("name", updatedName);
    });

    it("should update an app by name", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const updatedName = "UpdatedAppName";
      const appName = "TestApp";

      // Mock app resolution with a matching app name
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });
      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, name: appName, accountId }]);

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

      const { stderr } = await runCommand(
        ["apps:update", appName, "--name", updatedName],
        import.meta.url,
      );

      expect(stderr).toContain("App updated successfully");
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId;
      const appId = mock.getCurrentAppId()!;
      const customToken = "custom_access_token";
      const updatedName = "UpdatedAppName";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps) with custom token
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, name: "Test App", accountId }]);

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

      const { stderr } = await runCommand(
        ["apps:update", appId, "--name", updatedName],
        import.meta.url,
      );

      expect(stderr).toContain("App updated successfully");
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
        // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
        mockAppResolution(appId);
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

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "error",
      );
      expect(result).toBeDefined();
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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

      // Mock server error
      nockControl()
        .patch(`/v1/apps/${appId}`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["apps:update", appId, "--name", "NewName", "--json"],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "error",
      );
      expect(result).toBeDefined();
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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      // Mock the resolve step (GET /v1/me + GET /v1/accounts/:id/apps)
      mockAppResolution(appId);

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

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      );
      expect(result).toBeDefined();
      expect(result).toHaveProperty("command", "apps:update");
      expect(result).toHaveProperty("success", true);
      expect((result as Record<string, unknown>).app).toHaveProperty(
        "apnsUsesSandboxCert",
        false,
      );
    });
  });
});
