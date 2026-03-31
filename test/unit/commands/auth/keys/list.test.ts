import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
  mockAppResolution,
  getControlApiContext,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../../helpers/standard-tests.js";

describe("auth:keys:list command", () => {
  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should list all keys for the current app", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId,
            name: "Key One",
            key: `${appId}.key1:secret1`,
            capability: { "*": ["publish", "subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
          {
            id: "key2",
            appId,
            name: "Key Two",
            key: `${appId}.key2:secret2`,
            capability: { "*": ["subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(stdout).toContain(`Key Name: ${appId}.key1`);
      expect(stdout).toContain("Key Label: Key One");
      expect(stdout).toContain(`Key Name: ${appId}.key2`);
      expect(stdout).toContain("Key Label: Key Two");
    });

    it("should list keys with --app flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockAppResolution(appId);
      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId,
            name: "Test Key",
            key: `${appId}.key1:secret`,
            capability: { "*": ["publish"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:list", "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.key1`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should resolve app name to ID when --app is a name", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { accountId } = getControlApiContext();
      const meReply = {
        account: { id: accountId, name: "Test Account" },
        user: { email: "test@example.com" },
      };
      const appsReply = [{ id: appId, name: "MyApp", accountId }];

      // displayAuthInfo calls getApp → listApps (consumes /me + /apps)
      nockControl().get("/v1/me").reply(200, meReply);
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, appsReply);
      // requireAppId → resolveAppIdFromNameOrId also calls listApps
      nockControl().get("/v1/me").reply(200, meReply);
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, appsReply);
      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId,
            name: "Key One",
            key: `${appId}.key1:secret1`,
            capability: { "*": ["publish", "subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:list", "--app", "MyApp"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.key1`);
      expect(stdout).toContain("Key Label: Key One");
    });

    it("should show message when no keys found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/keys`).reply(200, []);

      const { stdout } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(stdout).toContain("No keys found");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId,
            name: "Test Key",
            key: `${appId}.key1:secret`,
            capability: { "*": ["publish", "subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "auth:keys:list");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("keys");
      expect(result.keys).toHaveLength(1);
      expect(result.keys[0]).toHaveProperty("name", "Test Key");
      expect(result.keys[0].created).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
      expect(result.keys[0].modified).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });
  });

  standardHelpTests("auth:keys:list", import.meta.url);

  standardArgValidationTests("auth:keys:list", import.meta.url);

  standardFlagTests("auth:keys:list", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should error when no app is selected", async () => {
      const mock = getMockConfigManager();
      const { accountId } = getControlApiContext();
      mock.setCurrentAppIdForAccount(undefined);

      // Mock the app resolution flow (requireAppId → promptForApp → listApps)
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, []);

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No apps found/);
    });

    standardControlApiErrorTests({
      commandArgs: ["auth:keys:list"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(`/v1/apps/${appId}/keys`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });
  });
});
