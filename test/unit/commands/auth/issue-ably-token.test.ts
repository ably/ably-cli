import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("auth:issue-ably-token command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  describe("successful token issuance", () => {
    it("should issue an Ably token successfully", async () => {
      const keyId = getMockConfigManager().getKeyId()!;
      const restMock = getMockAblyRest();
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

      restMock.auth.createTokenRequest.mockResolvedValue(mockTokenRequest);
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain(`Token: ${mockTokenDetails.token}`);
      expect(stdout).toContain("Type: Ably");
      expect(restMock.auth.createTokenRequest).toHaveBeenCalled();
      expect(restMock.auth.requestToken).toHaveBeenCalled();
    });

    it("should issue a token with custom capability", async () => {
      const restMock = getMockAblyRest();
      const customCapability = '{"chat:*":["publish","subscribe"]}';
      const mockTokenDetails = {
        token: "mock-ably-token-custom",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: customCapability,
        clientId: "ably-cli-test1234",
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--capability", customCapability],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(restMock.auth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = restMock.auth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.capability).toHaveProperty("chat:*");
    });

    it("should issue a token with custom TTL", async () => {
      const restMock = getMockAblyRest();
      const mockTokenDetails = {
        token: "mock-ably-token-ttl",
        issued: Date.now(),
        expires: Date.now() + 7200000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--ttl", "7200"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain("TTL: 7200 seconds");
      expect(restMock.auth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = restMock.auth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.ttl).toBe(7200000); // TTL in milliseconds
    });

    it("should issue a token with custom client ID", async () => {
      const restMock = getMockAblyRest();
      const customClientId = "my-custom-client";
      const mockTokenDetails = {
        token: "mock-ably-token-clientid",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: customClientId,
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--client-id", customClientId],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain(`Client ID: ${customClientId}`);
      expect(restMock.auth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = restMock.auth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.clientId).toBe(customClientId);
    });

    it("should issue a token with no client ID when 'none' is specified", async () => {
      const restMock = getMockAblyRest();
      const mockTokenDetails = {
        token: "mock-ably-token-no-client",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: undefined,
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--client-id", "none"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably Token");
      expect(stdout).toContain("Client ID: None");
      expect(restMock.auth.createTokenRequest).toHaveBeenCalled();
      const tokenParams = restMock.auth.createTokenRequest.mock.calls[0][0];
      expect(tokenParams.clientId).toBeUndefined();
    });

    it("should output only token string with --token-only flag", async () => {
      const restMock = getMockAblyRest();
      const mockTokenString = "mock-ably-token-only";
      const mockTokenDetails = {
        token: mockTokenString,
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "test",
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

      const { stdout } = await runCommand(
        ["auth:issue-ably-token", "--token-only"],
        import.meta.url,
      );

      // Should only output the token string
      expect(stdout.trim()).toBe(mockTokenString);
      expect(stdout).not.toContain("Generated Ably Token");
    });

    it("should output JSON format when --json flag is used", async () => {
      const restMock = getMockAblyRest();
      const mockTokenDetails = {
        token: "mock-ably-token-json",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

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
      const restMock = getMockAblyRest();
      restMock.auth.createTokenRequest.mockRejectedValue(
        new Error("Auth failed"),
      );

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
      const restMock = getMockAblyRest();
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockTokenDetails = {
        token: "mock-ably-token-app",
        issued: Date.now(),
        expires: Date.now() + 3600000,
        capability: '{"*":["*"]}',
        clientId: "ably-cli-test1234",
      };

      restMock.auth.createTokenRequest.mockResolvedValue({});
      restMock.auth.requestToken.mockResolvedValue(mockTokenDetails);

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
