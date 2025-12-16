import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("auth:revoke-token command", () => {
  const mockToken = "test-token-12345";
  const mockClientId = "test-client-id";

  beforeEach(() => {
    nock.cleanAll();

    // Set up a minimal mock Ably realtime client
    // The revoke-token command creates one but doesn't actually use it for the HTTP request
    if (globalThis.__TEST_MOCKS__) {
      globalThis.__TEST_MOCKS__.ablyRealtimeMock = {
        close: () => {},
      };
    }
  });

  afterEach(() => {
    nock.cleanAll();
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Revokes the token provided");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("--client-id");
      expect(stdout).toContain("--debug");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("revoke-token");
    });

    it("should show token argument is required", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("TOKEN");
    });
  });

  describe("argument validation", () => {
    it("should require token argument", async () => {
      const { error } = await runCommand(
        ["auth:revoke-token"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Missing 1 required arg");
      expect(error?.message).toContain("token");
    });
  });

  describe("token revocation", () => {
    it("should successfully revoke a token with client-id", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      // Mock the token revocation endpoint
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockClientId}`],
        })
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Token successfully revoked");
    });

    it("should use token as client-id when --client-id not provided", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      // When no client-id is provided, the token is used as the client-id
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockToken}`],
        })
        .reply(200, {});

      const { stdout, stderr } = await runCommand(
        ["auth:revoke-token", mockToken, "--api-key", apiKey],
        import.meta.url,
      );

      // Should show warnings about using token as client-id
      expect(stderr).toContain(
        "Revoking a specific token is only possible if it has a client ID",
      );
      expect(stderr).toContain("Using the token argument as a client ID");
      expect(stdout).toContain("Token successfully revoked");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockClientId}`],
        })
        .reply(200, { issuedBefore: 1234567890 });

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty(
        "message",
        "Token revocation processed successfully",
      );
      expect(result).toHaveProperty("response");
    });

    it("should handle token not found error with special message", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      // The command handles token_not_found specifically in the response body
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(404, "token_not_found");

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
        ],
        import.meta.url,
      );

      // Command outputs special message for token_not_found
      expect(stdout).toContain("Token not found or already revoked");
    });

    it("should handle authentication error (invalid API key)", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(401, { error: { message: "Unauthorized" } });

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401|error|revoking/i);
    });

    it("should handle server error", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500|error|revoking/i);
    });
  });

  describe("debug mode", () => {
    it("should show debug information when --debug flag is used", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
          "--debug",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Debug: Using API key:");
    });

    it("should mask the API key secret in debug output", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      const keySecret = apiKey.split(":")[1];
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          apiKey,
          "--debug",
        ],
        import.meta.url,
      );

      // Verify the secret part of the API key is masked
      expect(stdout).not.toContain(keySecret);
      expect(stdout).toContain("***");
    });
  });

  describe("flags", () => {
    it("should accept --debug flag", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--debug");
      expect(stdout).toContain("debug information");
    });

    it("should accept --client-id flag", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--client-id");
      expect(stdout).toContain("Client ID");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });
  });
});
