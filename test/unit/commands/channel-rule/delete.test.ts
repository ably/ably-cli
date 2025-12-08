import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("channel-rule:delete command (alias)", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockRuleId = "test-rule";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("alias behavior", () => {
    it("should execute the same as apps:channel-rules:delete", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, [
          {
            id: mockRuleId,
            persisted: false,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}/namespaces/${mockRuleId}`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["channel-rule:delete", mockRuleId, "--app", mockAppId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("deleted successfully");
    });

    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["channel-rule:delete", "--app", mockAppId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });
  });
});
