import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("auth:keys:get command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful key retrieval", () => {
    it("should get key details by full key name (APP_ID.KEY_ID)", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "Test Key",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:get", `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Key Name: ${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
      );
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should get key details with --app flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "Test Key",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:get", mockKeyId, "--app", DEFAULT_TEST_CONFIG.appId],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Key Name: ${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
      );
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should output JSON format when --json flag is used", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "Test Key",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:get",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("id", mockKeyId);
    });
  });

  describe("error handling", () => {
    it("should require keyNameOrValue argument", async () => {
      const { error } = await runCommand(["auth:keys:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle 404 key not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        ["auth:keys:get", `${DEFAULT_TEST_CONFIG.appId}.nonexistent`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:get", `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
