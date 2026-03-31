import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
  CONTROL_HOST,
  mockAppResolution,
  getControlApiContext,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("auth:keys:create command", () => {
  const mockKeyName = "TestKey";
  const mockKeyId = "test-key-id";
  const mockKeySecret = "test-key-secret";

  beforeEach(() => {
    controlApiCleanup();
    // Set up config without currentAppId to test "no app" error
    const mock = getMockConfigManager();
    mock.setCurrentAppIdForAccount(undefined);
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  describe("functionality", () => {
    it("should create a key successfully", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock the key creation endpoint
      nockControl()
        .post(`/v1/apps/${appId}/keys`, {
          name: mockKeyName,
          capability: { "*": ["*"] },
        })
        .reply(201, {
          id: mockKeyId,
          appId,
          name: mockKeyName,
          key: `${appId}.${mockKeyId}:${mockKeySecret}`,
          capability: { "*": ["*"] },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout, stderr } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );

      expect(stderr).toContain("Key created:");
      expect(stdout).toContain(mockKeyName);
      expect(stdout).toContain(mockKeyId);
    });

    it("should create a key with custom capabilities", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock the key creation endpoint with custom capabilities
      nockControl()
        .post(`/v1/apps/${appId}/keys`, {
          name: mockKeyName,
          capability: {
            channel1: ["publish", "subscribe"],
            channel2: ["history"],
          },
        })
        .reply(201, {
          id: mockKeyId,
          appId,
          name: mockKeyName,
          key: `${appId}.${mockKeyId}:${mockKeySecret}`,
          capability: {
            channel1: ["publish", "subscribe"],
            channel2: ["history"],
          },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout, stderr } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          appId,
          "--capabilities",
          '{"channel1":["publish","subscribe"],"channel2":["history"]}',
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Key created:");
      expect(stdout).toContain("channel1");
      expect(stdout).toContain("publish");
      expect(stdout).toContain("subscribe");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      const mockKey = {
        id: mockKeyId,
        appId,
        name: mockKeyName,
        key: `${appId}.${mockKeyId}:${mockKeySecret}`,
        capability: { "*": ["*"] },
        created: Date.now(),
        modified: Date.now(),
        status: "enabled",
        revocable: true,
      };

      // Mock the key creation endpoint
      nockControl().post(`/v1/apps/${appId}/keys`).reply(201, mockKey);

      const { stdout } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          appId,
          "--json",
        ],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      ) as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(result).toHaveProperty("command", "auth:keys:create");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("id", mockKeyId);
      expect(result.key).toHaveProperty("name", "TestKey");
      expect(result.key).toHaveProperty("key");
      expect(result.key.created).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
      expect(result.key.modified).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      const customToken = "custom_access_token";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      // Mock the key creation endpoint with custom token
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .post(`/v1/apps/${appId}/keys`)
        .reply(201, {
          id: mockKeyId,
          appId,
          name: mockKeyName,
          key: `${appId}.${mockKeyId}:${mockKeySecret}`,
          capability: { "*": ["*"] },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stderr } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );

      expect(stderr).toContain("Key created:");
    });
  });

  standardHelpTests("auth:keys:create", import.meta.url);

  standardFlagTests("auth:keys:create", import.meta.url, ["--json"]);

  describe("argument validation", () => {
    it("should require name parameter", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      const { error } = await runCommand(
        ["auth:keys:create", "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*name/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require app parameter when no current app is set", async () => {
      const { accountId } = getControlApiContext();
      // Mock the app resolution flow (requireAppId → promptForApp → listApps)
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, []);

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No apps found/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle invalid capabilities JSON", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock the key creation endpoint with invalid capabilities
      nockControl().post(`/v1/apps/${appId}/keys`).reply(400, {
        error: "Invalid capabilities format",
      });

      const { error } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          appId,
          "--capabilities",
          "invalid-json",
        ],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid capabilities/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock authentication failure
      nockControl()
        .post(`/v1/apps/${appId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock forbidden response
      nockControl()
        .post(`/v1/apps/${appId}/keys`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 not found error", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock not found response (app doesn't exist)
      nockControl()
        .post(`/v1/apps/${appId}/keys`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock server error
      nockControl()
        .post(`/v1/apps/${appId}/keys`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock network error
      nockControl()
        .post(`/v1/apps/${appId}/keys`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle validation errors from API", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock validation error
      nockControl().post(`/v1/apps/${appId}/keys`).reply(400, {
        error: "Validation failed",
        details: "Key name already exists",
      });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/400/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle rate limit errors", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock rate limit error
      nockControl()
        .post(`/v1/apps/${appId}/keys`)
        .reply(429, { error: "Rate limit exceeded" });

      const { error } = await runCommand(
        ["auth:keys:create", "--name", `"${mockKeyName}"`, "--app", appId],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/429/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("capability configurations", () => {
    it("should create a publish-only key", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock the key creation endpoint with publish-only capabilities
      nockControl()
        .post(`/v1/apps/${appId}/keys`, {
          name: mockKeyName,
          capability: { "channel:*": ["publish"] },
        })
        .reply(201, {
          id: mockKeyId,
          appId,
          name: mockKeyName,
          key: `${appId}.${mockKeyId}:${mockKeySecret}`,
          capability: { "channel:*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout, stderr } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          appId,
          "--capabilities",
          '{"channel:*":["publish"]}',
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Key created:");
      expect(stdout).toContain("publish");
    });

    it("should create a key with mixed capabilities", async () => {
      const appId = getMockConfigManager().getRegisteredAppId();
      mockAppResolution(appId);
      // Mock the key creation endpoint with subscribe-only capabilities
      nockControl()
        .post(`/v1/apps/${appId}/keys`, {
          name: mockKeyName,
          capability: {
            "channel:chat-*": ["subscribe"],
            "channel:updates": ["publish"],
          },
        })
        .reply(201, {
          id: mockKeyId,
          appId,
          name: mockKeyName,
          key: `${appId}.${mockKeyId}:${mockKeySecret}`,
          capability: {
            "channel:chat-*": ["subscribe"],
            "channel:updates": ["publish"],
          },
          created: Date.now(),
          modified: Date.now(),
          status: "enabled",
          revocable: true,
        });

      const { stdout, stderr } = await runCommand(
        [
          "auth:keys:create",
          "--name",
          `"${mockKeyName}"`,
          "--app",
          appId,
          "--capabilities",
          '{"channel:chat-*":["subscribe"],"channel:updates":["publish"]}',
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Key created:");
      expect(stdout).toContain("chat-*");
      expect(stdout).toContain("subscribe");
      expect(stdout).toContain("updates");
    });
  });
});
