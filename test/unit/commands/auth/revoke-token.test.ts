import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRealtimeMock?: {
      close: () => void;
    };
  };
}

describe("auth:revoke-token command", () => {
  const mockApiKey = "appid.keyid:secret";
  const mockAppId = "appid";
  const mockKeyName = "appid.keyid";
  const mockToken = "test-token-12345";
  const mockClientId = "test-client-id";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    nock.cleanAll();

    // Create a temporary config directory with current app set
    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    // Create a minimal config file with the current app set
    const configContent = `[current]
account = "default"
app = "${mockAppId}"

[accounts.default]
accountId = "test-account"
accountName = "Test Account"
userEmail = "test@example.com"

[accounts.default.apps.${mockAppId}]
appName = "Test App"
apiKey = "${mockApiKey}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);

    // Set up a minimal mock Ably realtime client
    // The revoke-token command creates one but doesn't actually use it for the HTTP request
    globalThis.__TEST_MOCKS__ = {
      ablyRealtimeMock: {
        close: () => {},
      },
    };
  });

  afterEach(() => {
    nock.cleanAll();
    delete globalThis.__TEST_MOCKS__;
    process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
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
      // Mock the token revocation endpoint
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`, {
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
          mockApiKey,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Token successfully revoked");
    });

    it("should use token as client-id when --client-id not provided", async () => {
      // When no client-id is provided, the token is used as the client-id
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`, {
          targets: [`clientId:${mockToken}`],
        })
        .reply(200, {});

      const { stdout, stderr } = await runCommand(
        ["auth:revoke-token", mockToken, "--api-key", mockApiKey],
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
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`, {
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
          mockApiKey,
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
      // The command handles token_not_found specifically in the response body
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`)
        .reply(404, "token_not_found");

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          mockApiKey,
        ],
        import.meta.url,
      );

      // Command outputs special message for token_not_found
      expect(stdout).toContain("Token not found or already revoked");
    });

    it("should handle authentication error (invalid API key)", async () => {
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`)
        .reply(401, { error: { message: "Unauthorized" } });

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          mockApiKey,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401|error|revoking/i);
    });

    it("should handle server error", async () => {
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          mockApiKey,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500|error|revoking/i);
    });
  });

  describe("debug mode", () => {
    it("should show debug information when --debug flag is used", async () => {
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          mockApiKey,
          "--debug",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Debug: Using API key:");
    });

    it("should mask the API key secret in debug output", async () => {
      nock("https://rest.ably.io")
        .post(`/keys/${mockKeyName}/revokeTokens`)
        .reply(200, {});

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--api-key",
          mockApiKey,
          "--debug",
        ],
        import.meta.url,
      );

      // Verify the secret part of the API key is masked
      expect(stdout).not.toContain("secret");
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
