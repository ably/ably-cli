import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("auth:issue-ably-token command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockApiKey = `${mockAppId}.testkey:testsecret`;
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

[accounts.default.apps."${mockAppId}"]
appName = "Test App"
apiKey = "${mockApiKey}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }

    globalThis.__TEST_MOCKS__ = undefined;
  });

  describe("successful token issuance", () => {
    it("should issue an Ably token successfully", async () => {
      const mockTokenDetails = {
        token: "mock-ably-token-12345",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      const mockTokenRequest = {
        keyName: `${mockAppId}.testkey`,
        ttl: 3600000,
        capability: '{"*":["*"]}',
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue(mockTokenRequest),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain(`Token: ${mockTokenDetails.token}`);
      expect(stdout).toContain("Type: Ably");
      expect(mockAuth.createTokenRequest).toHaveBeenCalled();
      expect(mockAuth.requestToken).toHaveBeenCalled();
    });

    it("should issue a token with custom capability", async () => {
      const customCapability = '{"chat:*":["publish","subscribe"]}';
      const mockTokenDetails = {
        token: "mock-ably-token-custom",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: customCapability,
        clientId: "ably-cli-test1234",
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--capability", customCapability],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(mockAuth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = mockAuth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.capability).toHaveProperty("chat:*");
    });

    it("should issue a token with custom TTL", async () => {
      const mockTokenDetails = {
        token: "mock-ably-token-ttl",
        issued: Date.now(),
        expires: Date.now() + 7200000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--ttl", "7200"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain("TTL: 7200 seconds");
      expect(mockAuth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = mockAuth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.ttl).toBe(7200000); // TTL in milliseconds
    });

    it("should issue a token with custom client ID", async () => {
      const customClientId = "my-custom-client";
      const mockTokenDetails = {
        token: "mock-ably-token-clientid",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: customClientId,
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--client-id", customClientId],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain(`Client ID: ${customClientId}`);
      expect(mockAuth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = mockAuth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.clientId).toBe(customClientId);
    });

    it("should issue a token with no client ID when 'none' is specified", async () => {
      const mockTokenDetails = {
        token: "mock-ably-token-no-client",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: undefined,
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--client-id", "none"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain("Client ID: None");
      expect(mockAuth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = mockAuth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.clientId).toBeUndefined();
    });

    it("should output only token string with --token-only flag", async () => {
      const mockTokenString = "mock-ably-token-only";
      const mockTokenDetails = {
        token: mockTokenString,
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "test",
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--token-only"],
        import.meta.url,
      );

      // Should only output the token string
      expect(stdout.trim()).toBe(mockTokenString);
      expect(stdout).not.toContain("Generated Ably Token");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockTokenDetails = {
        token: "mock-ably-token-json",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("capability");
    });
  });

  describe("error handling", () => {
    it("should handle invalid capability JSON", async () => {
      const { error } = await runCommand(
        ["auth:issue-ably-token", "--capability", "invalid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid capability JSON/i);
    });

    it("should handle token creation failure", async () => {
      const mockAuth = {
        createTokenRequest: vi.fn().mockRejectedValue(new Error("Auth failed")),
        requestToken: vi.fn(),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { error } = await runCommand(
        ["auth:issue-ably-token"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error issuing Ably token/i);
    });

    it("should not produce token output when app configuration is missing", async () => {
      // Remove app from config
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token"],
        import.meta.url,
      );

      // When no app is configured, command should not produce token output
      expect(stdout).not.toContain("Generated Ably Token");
    });
  });

  describe("command arguments and flags", () => {
    it("should accept --app flag to specify app", async () => {
      const mockTokenDetails = {
        token: "mock-ably-token-app",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue({}),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRestMock: {
          auth: mockAuth,
          close: vi.fn(),
        },
      };

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--app", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["auth:issue-ably-token", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
