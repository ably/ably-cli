import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

describe("auth:keys:create command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "MockAccount";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockKeyName = "TestKey";
  const mockKeyId = "test-key-id";
  const mockKeySecret = "test-key-secret";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    // Set environment variable for access token
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    // Create a temporary config directory for testing
    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    // Create a minimal config file with a default account
    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    // Clean up nock interceptors
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;
    process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
  });

  describe("successful key creation", () => {
    it("should create a key successfully", async () => {
      // Mock the key creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`, {
          name: mockKeyName,
          capability: { "*": ["*"] },
        })
        .reply(201, {
          id: mockKeyId,
          appId: mockAppId,
          name: mockKeyName,
          key: `${mockAppId}.${mockKeyId}:${mockKeySecret}`,
          capability: { "*": ["*"] },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain("Key created successfully");
      expect(stdout).toContain(mockKeyName);
      expect(stdout).toContain(mockKeyId);
    });

    it("should create a key with custom capabilities", async () => {
      // Mock the key creation endpoint with custom capabilities
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`, {
          name: mockKeyName,
          capability: {
            channel1: ["publish", "subscribe"],
            channel2: ["history"],
          },
        })
        .reply(201, {
          id: mockKeyId,
          appId: mockAppId,
          name: mockKeyName,
          key: `${mockAppId}.${mockKeyId}:${mockKeySecret}`,
          capability: {
            channel1: ["publish", "subscribe"],
            channel2: ["history"],
          },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          mockAppId,
          "--capabilities",
          '{"channel1":["publish","subscribe"],"channel2":["history"]}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Key created successfully");
      expect(stdout).toContain("channel1");
      expect(stdout).toContain("publish");
      expect(stdout).toContain("subscribe");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockKey = {
        id: mockKeyId,
        appId: mockAppId,
        name: mockKeyName,
        key: `${mockAppId}.${mockKeyId}:${mockKeySecret}`,
        capability: { "*": ["*"] },
        created: Date.now(),
        modified: Date.now(),
        status: "enabled",
        revocable: true,
      };

      // Mock the key creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(201, mockKey);

      const { stdout } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          mockAppId,
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("id", mockKeyId);
      expect(result.key).toHaveProperty("name", "TestKey");
      expect(result.key).toHaveProperty("key");
      expect(result).toHaveProperty("success", true);
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";

      // Mock the key creation endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(201, {
          id: mockKeyId,
          appId: mockAppId,
          name: mockKeyName,
          key: `${mockAppId}.${mockKeyId}:${mockKeySecret}`,
          capability: { "*": ["*"] },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          mockAppId,
          "--access-token",
          "custom_access_token",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Key created successfully");
    });
  });

  describe("parameter validation", () => {
    it("should require name parameter", async () => {
      const { error } = await runCommand(
        ["auth:keys:create", "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*name/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require app parameter when no current app is set", async () => {
      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No app specified/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle invalid capabilities JSON", async () => {
      // Mock the key creation endpoint with invalid capabilities
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(400, {
          error: "Invalid capabilities format",
        });

      const { error } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          mockAppId,
          "--capabilities",
          "invalid-json",
        ],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Invalid capabilities/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock authentication failure
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock forbidden response
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 not found error", async () => {
      // Mock not found response (app doesn't exist)
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      // Mock server error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle validation errors from API", async () => {
      // Mock validation error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(400, {
          error: "Validation failed",
          details: "Key name already exists",
        });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle rate limit errors", async () => {
      // Mock rate limit error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`)
        .reply(429, { error: "Rate limit exceeded" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", mockAppId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/429/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("capability configurations", () => {
    it("should create a publish-only key", async () => {
      // Mock the key creation endpoint with publish-only capabilities
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`, {
          name: mockKeyName,
          capability: { "channel:*": ["publish"] },
        })
        .reply(201, {
          id: mockKeyId,
          appId: mockAppId,
          name: mockKeyName,
          key: `${mockAppId}.${mockKeyId}:${mockKeySecret}`,
          capability: { "channel:*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          mockAppId,
          "--capabilities",
          '{"channel:*":["publish"]}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Key created successfully");
      expect(stdout).toContain("publish");
    });

    it("should create a key with mixed capabilities", async () => {
      // Mock the key creation endpoint with subscribe-only capabilities
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/keys`, {
          name: mockKeyName,
          capability: {
            "channel:chat-*": ["subscribe"],
            "channel:updates": ["publish"],
          },
        })
        .reply(201, {
          id: mockKeyId,
          appId: mockAppId,
          name: mockKeyName,
          key: `${mockAppId}.${mockKeyId}:${mockKeySecret}`,
          capability: {
            "channel:chat-*": ["subscribe"],
            "channel:updates": ["publish"],
          },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          mockAppId,
          "--capabilities",
          '{"channel:chat-*":["subscribe"],"channel:updates":["publish"]}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Key created successfully");
      expect(stdout).toContain("chat-*");
      expect(stdout).toContain("subscribe");
      expect(stdout).toContain("updates");
    });
  });
});
