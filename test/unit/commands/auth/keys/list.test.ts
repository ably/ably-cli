import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("auth:keys:list command", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful key listing", () => {
    it("should list all keys for the current app", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
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
      nock("https://control.ably.net")
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

    it("should show message when no keys found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, []);

      const { stdout } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(stdout).toContain("No keys found");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
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
      expect(result).toHaveProperty("keys");
      expect(result.keys).toHaveLength(1);
      expect(result.keys[0]).toHaveProperty("name", "Test Key");
    });
  });

  describe("error handling", () => {
    it("should error when no app is selected", async () => {
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No app specified/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle network errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys`)
        .replyWithError("Network error");

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
