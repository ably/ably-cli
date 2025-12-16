import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("auth:issue-ably-token command", () => {
  beforeEach(() => {
    // Clean up any test mocks from previous tests
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }
  });

  afterEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }
  });

  describe("successful token issuance", () => {
    it("should issue an Ably token successfully", async () => {
      const keyId = getMockConfigManager().getKeyId()!;
      const mockTokenDetails = {
        token: "mock-ably-token-12345",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      const mockTokenRequest = {
        keyName: keyId,
        ttl: 3600000,
        capability: '{"*":["*"]}',
      };

      const mockAuth = {
        createTokenRequest: vi.fn().mockResolvedValue(mockTokenRequest),
        requestToken: vi.fn().mockResolvedValue(mockTokenDetails),
      };

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

      const { error } = await runCommand(
        ["auth:issue-ably-token"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error issuing Ably token/i);
    });

    it("should not produce token output when app configuration is missing", async () => {
      // Use mock config manager to clear app configuration
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

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
      const appId = getMockConfigManager().getCurrentAppId()!;
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

      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRestMock = {
          auth: mockAuth,
          close: vi.fn(),
        };
      }

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--app", appId],
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
