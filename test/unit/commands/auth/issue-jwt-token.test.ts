import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import jwt from "jsonwebtoken";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseJsonOutput } from "../../../helpers/ndjson.js";

describe("auth:issue-jwt-token command", () => {
  describe("functionality", () => {
    it("should issue a JWT token successfully", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const keyId = mockConfig.getKeyId()!;
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token"],
        import.meta.url,
      );

      expect(stdout).toContain("Ably JWT token generated.");
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
      }) as jwt.JwtPayload;

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
      }) as jwt.JwtPayload;

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
      }) as jwt.JwtPayload;

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
      }) as jwt.JwtPayload;

      expect(decoded["x-ably-clientId"]).toBeUndefined();
    });

    it("should output only token string with --token-only flag", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--token-only"],
        import.meta.url,
      );

      // Should only output the token string (no "Generated" message)
      expect(stdout).not.toContain("Ably JWT token generated.");
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

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "auth:issue-jwt-token");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("token");
      expect(result.token).toHaveProperty("appId", appId);
      expect(result.token).toHaveProperty("keyId", keyId);
      expect(result.token).toHaveProperty("tokenType", "jwt");
      expect(result.token).toHaveProperty("capability");
      expect(result.token).toHaveProperty("ttl");
      expect(result.token).toHaveProperty("value");
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
      }) as jwt.JwtPayload;

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
      }) as jwt.JwtPayload;

      // Default TTL is 3600 seconds (1 hour)
      expect(decoded.exp - decoded.iat).toBe(3600);
    });
  });

  standardHelpTests("auth:issue-jwt-token", import.meta.url);

  describe("error handling", () => {
    it("should handle invalid capability JSON", async () => {
      const { error } = await runCommand(
        ["auth:issue-jwt-token", "--capability", "invalid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/is not valid JSON/i);
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
      expect(stdout).not.toContain("Ably JWT token generated.");
    });
  });

  standardArgValidationTests("auth:issue-jwt-token", import.meta.url);

  standardFlagTests("auth:issue-jwt-token", import.meta.url, ["--json"]);

  describe("output formatting", () => {
    it("should display TTL in output", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--ttl", "1800"],
        import.meta.url,
      );

      expect(stdout).toContain("TTL: 1800 seconds");
    });

    it("should display client ID when specified", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--client-id", "my-client"],
        import.meta.url,
      );

      expect(stdout).toContain("Client ID: my-client");
    });

    it("should omit client ID line when not specified with none", async () => {
      const { stdout } = await runCommand(
        ["auth:issue-jwt-token", "--client-id", "none"],
        import.meta.url,
      );

      expect(stdout).not.toContain("Client ID:");
    });
  });
});
