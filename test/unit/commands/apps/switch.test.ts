import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("apps:switch command", () => {
  let mockAccountId: string;
  let mockAccountName: string;
  let mockUserEmail: string;
  let mockAppId: string;
  const mockAppName = "Switched App";

  beforeEach(() => {
    const mockConfig = getMockConfigManager();
    const account = mockConfig.getCurrentAccount()!;
    mockAccountId = account.accountId!;
    mockAccountName = account.accountName!;
    mockUserEmail = account.userEmail!;
    mockAppId = mockConfig.getCurrentAppId()!;
  });

  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("apps:switch", import.meta.url);
  standardArgValidationTests("apps:switch", import.meta.url);

  describe("functionality", () => {
    it("should switch to an app when appId is provided", async () => {
      // Single listApps() call: GET /v1/me + GET /v1/accounts/:id/apps
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stderr } = await runCommand(
        ["apps:switch", mockAppId],
        import.meta.url,
      );

      expect(stderr).toContain("Switched to app");
      expect(stderr).toContain(mockAppName);
      expect(stderr).toContain(mockAppId);
    });

    it("should output JSON when --json flag is used", async () => {
      // Single listApps() call: GET /v1/me + GET /v1/accounts/:id/apps
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["apps:switch", mockAppId, "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "apps:switch");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", mockAppId);
      expect(result.app).toHaveProperty("name", mockAppName);
    });

    it("should switch to an app when app name is provided", async () => {
      const appName = "SwitchedApp";

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: appName,
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["apps:switch", appName, "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
      expect(result.app).toHaveProperty("id", mockAppId);
      expect(result.app).toHaveProperty("name", appName);
    });
  });

  standardFlagTests("apps:switch", import.meta.url, [
    "--json",
    "--pretty-json",
  ]);

  describe("error handling", () => {
    it("should handle app not found error", async () => {
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      nockControl().get(`/v1/accounts/${mockAccountId}/apps`).reply(200, []);

      const { error } = await runCommand(
        ["apps:switch", "nonexistent-app"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle 401 authentication error", async () => {
      nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:switch", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should handle network errors", async () => {
      nockControl().get("/v1/me").replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:switch", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
    });
  });
});
