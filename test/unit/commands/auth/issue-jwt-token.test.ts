import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import jwt from "jsonwebtoken";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("auth:issue-jwt-token command", () => {
  describe("successful JWT token issuance", () => {
    it("should issue a JWT token successfully", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const keyId = mockConfig.getKeyId()!;
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token"],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably JWT Token");
      expect(stdout).toContain("Token:");
      expect(stdout).toContain("Type: JWT");
      expect(stdout).toContain(`App ID: ${appId}`);
      expect(stdout).toContain(`Key ID: ${keyId}`);
      expect(stdout).toContain("Issued:");
      expect(stdout).toContain("Expires:");
    });

    it("should generate a valid JWT token", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const apiKey = mockConfig.getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--token-only"],
        import.meta.url,
      );

      const token = stdout.trim();
      expect(token).toBeTruthy();

      // Verify the token is a valid JWT
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      });
      expect(decoded).toHaveProperty("x-ably-appId", appId);
      expect(decoded).toHaveProperty("x-ably-capability");
    });

    it("should issue a token with custom capability", async () => {
      const apiKey = getMockConfigManager().getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const customCapability = '{"chat:*":["publish","subscribe"]}';

      const { stdout } = await runCommand(
        [
          "auth:issue-jwt-token",
          "--capability",
          customCapability,
          "--token-only",
        ],
        import.meta.url,
      );

      const token = stdout.trim();
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      }) as any;

      expect(decoded["x-ably-capability"]).toHaveProperty("chat:*");
      expect(decoded["x-ably-capability"]["chat:*"]).toContain("publish");
      expect(decoded["x-ably-capability"]["chat:*"]).toContain("subscribe");
    });

    it("should issue a token with custom TTL", async () => {
      const apiKey = getMockConfigManager().getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const ttl = 7200; // 2 hours

      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--ttl", ttl.toString(), "--token-only"],
        import.meta.url,
      );

      const token = stdout.trim();
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      }) as any;

      // Check that exp - iat equals TTL
      expect(decoded.exp - decoded.iat).toBe(ttl);
    });

    it("should issue a token with custom client ID", async () => {
      const apiKey = getMockConfigManager().getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const customClientId = "my-custom-client";

      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--client-id", customClientId, "--token-only"],
        import.meta.url,
      );

      const token = stdout.trim();
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      }) as any;

      expect(decoded["x-ably-clientId"]).toBe(customClientId);
    });

    it("should issue a token with no client ID when 'none' is specified", async () => {
      const apiKey = getMockConfigManager().getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--client-id", "none", "--token-only"],
        import.meta.url,
      );

      const token = stdout.trim();
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      }) as any;

      expect(decoded["x-ably-clientId"]).toBeUndefined();
    });

    it("should output only token string with --token-only flag", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--token-only"],
        import.meta.url,
      );

      // Should only output the token string (no "Generated" message)
      expect(stdout).not.toContain("Generated Ably JWT Token");
      expect(stdout.trim().split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const keyId = mockConfig.getKeyId()!;
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("appId", appId);
      expect(result).toHaveProperty("keyId", keyId);
      expect(result).toHaveProperty("type", "jwt");
      expect(result).toHaveProperty("capability");
      expect(result).toHaveProperty("ttl");
    });

    it("should generate token with default capability of all permissions", async () => {
      const apiKey = getMockConfigManager().getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--token-only"],
        import.meta.url,
      );

      const token = stdout.trim();
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      }) as any;

      expect(decoded["x-ably-capability"]).toHaveProperty("*");
      expect(decoded["x-ably-capability"]["*"]).toContain("*");
    });

    it("should generate token with default TTL of 1 hour", async () => {
      const apiKey = getMockConfigManager().getApiKey()!;
      const mockKeySecret = apiKey.split(":")[1];
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--token-only"],
        import.meta.url,
      );

      const token = stdout.trim();
      const decoded = jwt.verify(token, mockKeySecret, {
        algorithms: ["HS256"],
      }) as any;

      // Default TTL is 3600 seconds (1 hour)
      expect(decoded.exp - decoded.iat).toBe(3600);
    });
  });

  describe("error handling", () => {
    it("should handle invalid capability JSON", async () => {
      const { error } = await runCommand(
        ["auth:issue-jwt-token", "--capability", "invalid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid capability JSON/i);
    });

    it("should not produce token output when app configuration is missing", async () => {
      // Use mock config manager to clear app configuration
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

      const { stdout } = await runCommand(
        ["auth:issue-jwt-token"],
        import.meta.url,
      );

      // When no app is configured, command should not produce token output
      expect(stdout).not.toContain("Generated Ably JWT Token");
    });
  });

  describe("command arguments and flags", () => {
    it("should accept --app flag to specify app", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain("Generated Ably JWT Token");
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["auth:issue-jwt-token", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("output formatting", () => {
    it("should display TTL in output", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--ttl", "1800"],
        import.meta.url,
      );

      expect(stdout).toContain("TTL: 1800 seconds");
    });

    it("should display client ID as None when not specified with none", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--client-id", "none"],
        import.meta.url,
      );

      expect(stdout).toContain("Client ID: None");
    });
  });
});
