import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("auth:keys:revoke command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful key revocation", () => {
    it("should display key info before revocation", async () => {
      // Mock get key details
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

      // Mock revoke key
      nock("https://control.ably.net")
        .post(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}/revoke`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:keys:revoke",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--force",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Key Name: ${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
      );
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should revoke key with --app flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "Test Key",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .post(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}/revoke`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:keys:revoke",
          mockKeyId,
          "--app",
          DEFAULT_TEST_CONFIG.appId,
          "--force",
        ],
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

      nock("https://control.ably.net")
        .post(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}/revoke`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:keys:revoke",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--force",
          "--json",
        ],
        import.meta.url,
      );

      // The JSON output should be parseable
      const result = JSON.parse(stdout);
      // Either success or error with keyName property
      expect(typeof result).toBe("object");
    });
  });

  describe("error handling", () => {
    it("should require keyName argument", async () => {
      const { error } = await runCommand(
        ["auth:keys:revoke", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle 404 key not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        [
          "auth:keys:revoke",
          `${DEFAULT_TEST_CONFIG.appId}.nonexistent`,
          "--force",
        ],
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
        [
          "auth:keys:revoke",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
