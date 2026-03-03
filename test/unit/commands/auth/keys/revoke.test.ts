import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

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
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock get key details
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "Test Key",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      // Mock revoke key
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/keys/${mockKeyId}/revoke`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["auth:keys:revoke", `${appId}.${mockKeyId}`, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should revoke key with --app flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "Test Key",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/keys/${mockKeyId}/revoke`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["auth:keys:revoke", mockKeyId, "--app", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "Test Key",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/keys/${mockKeyId}/revoke`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["auth:keys:revoke", `${appId}.${mockKeyId}`, "--force", "--json"],
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        ["auth:keys:revoke", `${appId}.nonexistent`, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:revoke", `${appId}.${mockKeyId}`, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
