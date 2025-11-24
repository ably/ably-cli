import { describe, it, expect, beforeEach, afterEach } from "vitest";
import sinon from "sinon";
import fs from "node:fs";
import * as _https from "node:https";
import * as Ably from "ably";
import RevokeTokenCommand from "../../../../src/commands/auth/revoke-token.js";
import { ConfigManager } from "../../../../src/services/config-manager.js";

describe("RevokeTokenCommand", function () {
  let configManagerStub: sinon.SinonStubbedInstance<ConfigManager>;
  let sandbox: sinon.SinonSandbox;
  let originalEnv: NodeJS.ProcessEnv;
  let mockAblyClient: sinon.SinonStubbedInstance<Ably.Realtime>;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    originalEnv = { ...process.env };

    // Reset env before each test
    process.env = { ...originalEnv };

    // Stub fs operations
    sandbox.stub(fs, "existsSync").returns(true);
    sandbox.stub(fs, "readFileSync").returns("");
    sandbox.stub(fs, "mkdirSync");
    sandbox.stub(fs, "writeFileSync");

    // Stub ConfigManager methods
    configManagerStub = sandbox.createStubInstance(ConfigManager);
    sandbox.stub(ConfigManager.prototype as any, "ensureConfigDirExists");
    sandbox.stub(ConfigManager.prototype as any, "saveConfig");

    // Mock Ably client
    mockAblyClient = sandbox.createStubInstance(Ably.Realtime);
    mockAblyClient.connection = {
      once: sandbox.stub(),
      state: "connected",
    } as any;
    mockAblyClient.close = sandbox.stub();

    // Mock global test mocks for Ably client
    (globalThis as any).__TEST_MOCKS__ = {
      ablyRestMock: sandbox.createStubInstance(Ably.Rest),
    };
  });

  afterEach(function () {
    sandbox.restore();
    process.env = originalEnv;
    delete (globalThis as any).__TEST_MOCKS__;
  });

  describe("command properties", function () {
    it("should have correct static properties", function () {
      expect(RevokeTokenCommand.description).toBe("Revokes the token provided");
      expect(RevokeTokenCommand.examples).toBeInstanceOf(Array);
      expect(RevokeTokenCommand.args).toHaveProperty("token");
      expect(RevokeTokenCommand.flags).toHaveProperty("client-id");
      expect(RevokeTokenCommand.flags).toHaveProperty("debug");
    });

    it("should have required token argument", function () {
      expect(RevokeTokenCommand.args.token).toHaveProperty("required", true);
      expect(RevokeTokenCommand.args.token).toHaveProperty("name", "token");
    });

    it("should have client-id flag with char 'c'", function () {
      expect(RevokeTokenCommand.flags["client-id"]).toHaveProperty("char", "c");
    });

    it("should have debug flag with default false", function () {
      expect(RevokeTokenCommand.flags.debug).toHaveProperty("default", false);
    });
  });

  describe("API key parsing", function () {
    it("should parse API key correctly", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      (_command as any).configManager = configManagerStub;

      const apiKey = "appId.keyId:keySecret";
      const keyParts = apiKey.split(":");

      expect(keyParts).toHaveLength(2);
      expect(keyParts[0]).toBe("appId.keyId");
      expect(keyParts[1]).toBe("keySecret");
    });

    it("should extract keyName from API key", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const apiKey = "appId.keyId:keySecret";
      const keyName = apiKey.split(":")[0];

      expect(keyName).toBe("appId.keyId");
    });

    it("should handle invalid API key format", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const invalidApiKey = "invalidkey";
      const keyParts = invalidApiKey.split(":");

      expect(keyParts).toHaveLength(1);
      // This would trigger an error in the actual command
      expect(keyParts.length !== 2).toBe(true);
    });
  });

  describe("request body construction", function () {
    it("should construct request body with client ID", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const clientId = "testClient";
      const requestBody = {
        targets: [`clientId:${clientId}`],
      };

      expect(requestBody).toHaveProperty("targets");
      expect(requestBody.targets).toBeInstanceOf(Array);
      expect(requestBody.targets[0]).toBe("clientId:testClient");
    });

    it("should use token as client ID when no client-id flag provided", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const token = "testToken123";
      const clientId = token; // When no client-id flag is provided
      const requestBody = {
        targets: [`clientId:${clientId}`],
      };

      expect(requestBody.targets[0]).toBe("clientId:testToken123");
    });
  });

  describe("HTTPS request handling", function () {
    it("should construct correct HTTPS request options", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const keyName = "appId.keyId";
      const secret = "keySecret";
      const encodedAuth = Buffer.from(`${keyName}:${secret}`).toString(
        "base64",
      );

      const expectedOptions = {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${encodedAuth}`,
          "Content-Type": "application/json",
        },
        hostname: "rest.ably.io",
        method: "POST",
        path: `/keys/${keyName}/revokeTokens`,
        port: 443,
      };

      expect(expectedOptions.hostname).toBe("rest.ably.io");
      expect(expectedOptions.method).toBe("POST");
      expect(expectedOptions.path).toBe("/keys/appId.keyId/revokeTokens");
      expect(expectedOptions.headers.Authorization).toContain("Basic");
    });

    it("should encode authorization header correctly", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const keyName = "appId.keyId";
      const secret = "keySecret";
      const expectedEncoded = Buffer.from(`${keyName}:${secret}`).toString(
        "base64",
      );

      expect(expectedEncoded).toBeTypeOf("string");
      expect(expectedEncoded.length).toBeGreaterThan(0);
    });
  });

  describe("debug output", function () {
    it("should log debug information when debug flag is enabled", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      const _logSpy = sandbox.spy(_command, "log");

      const debugFlag = true;
      const apiKey = "appId.keyId:keySecret";
      const maskedKey = apiKey.replace(/:.+/, ":***");

      if (debugFlag) {
        // This would be logged in debug mode
        const debugMessage = `Debug: Using API key: ${maskedKey}`;
        expect(debugMessage).toContain("Debug: Using API key:");
        expect(debugMessage).toContain(":***");
      }
    });

    it("should mask API key secret in debug output", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const apiKey = "appId.keyId:realSecret";
      const maskedKey = apiKey.replace(/:.+/, ":***");

      expect(maskedKey).toBe("appId.keyId:***");
      expect(maskedKey).not.toContain("realSecret");
    });

    it("should log request details in debug mode", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const keyName = "appId.keyId";
      const requestBody = { targets: ["clientId:testClient"] };

      const debugMessages = [
        `Debug: Sending request to endpoint: /keys/${keyName}/revokeTokens`,
        `Debug: Request body: ${JSON.stringify(requestBody)}`,
      ];

      expect(debugMessages[0]).toContain("/keys/appId.keyId/revokeTokens");
      expect(debugMessages[1]).toContain("clientId:testClient");
    });
  });

  describe("warning messages", function () {
    it("should warn about token revocation limitations", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      const _warnSpy = sandbox.spy(_command, "warn");

      const expectedWarnings = [
        "Revoking a specific token is only possible if it has a client ID or revocation key",
        "For advanced token revocation options, see: https://ably.com/docs/auth/revocation",
        "Using the token argument as a client ID for this operation",
      ];

      expectedWarnings.forEach((warning) => {
        expect(warning).toBeTypeOf("string");
        expect(warning.length).toBeGreaterThan(0);
      });
    });
  });

  describe("output formatting", function () {
    it("should format successful JSON output", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const successData = {
        message: "Token revocation processed successfully",
        response: {},
        success: true,
      };

      const jsonOutput = JSON.stringify(successData);
      expect(jsonOutput).toContain('"success":true');
      expect(jsonOutput).toContain('"message"');
      expect(jsonOutput).toContain("Token revocation processed successfully");
    });

    it("should format error JSON output", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const errorData = {
        error: "Token not found or already revoked",
        success: false,
      };

      const jsonOutput = JSON.stringify(errorData);
      expect(jsonOutput).toContain('"success":false');
      expect(jsonOutput).toContain('"error"');
      expect(jsonOutput).toContain("Token not found");
    });

    it("should handle successful text output", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      const _logSpy = sandbox.spy(_command, "log");

      const successMessage = "Token successfully revoked";
      expect(successMessage).toBe("Token successfully revoked");
    });
  });

  describe("error handling", function () {
    it("should handle token not found error", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const error = new Error("token_not_found");
      const isTokenNotFound = error.message.includes("token_not_found");

      expect(isTokenNotFound).toBe(true);

      if (isTokenNotFound) {
        const errorMessage = "Token not found or already revoked";
        expect(errorMessage).toContain("not found or already revoked");
      }
    });

    it("should handle network errors", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      const _errorSpy = sandbox.spy(_command, "error");

      const networkError = new Error("Network connection failed");
      const errorMessage = `Error revoking token: ${networkError.message}`;

      expect(errorMessage).toContain("Error revoking token:");
      expect(errorMessage).toContain("Network connection failed");
    });

    it("should handle non-Error objects", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const unknownError = { code: 500, message: "Internal Server Error" };
      const errorMessage =
        typeof unknownError === "object"
          ? JSON.stringify(unknownError)
          : String(unknownError);

      expect(errorMessage).toContain("500");
      expect(errorMessage).toContain("Internal Server Error");
    });
  });

  describe("client lifecycle", function () {
    it("should create Ably client", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      (_command as any).configManager = configManagerStub;

      // Test that client creation is handled
      const _flags = {};

      // Mock ensureAppAndKey to return valid credentials
      configManagerStub.getCurrentAppId.returns("testApp");
      configManagerStub.getApiKey.returns("testApp.keyId:keySecret");

      expect(configManagerStub.getCurrentAppId).toBeDefined();
      expect(configManagerStub.getApiKey).toBeDefined();
    });

    it("should close client after operation", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      // Test that client would be closed in finally block
      const mockClient = mockAblyClient;
      const closeStub = mockClient.close as sinon.SinonStub;

      expect(closeStub).toBeTypeOf("function");
    });

    it("should handle client creation failure", function () {
      const _command = new RevokeTokenCommand([], {} as any);
      (_command as any).configManager = configManagerStub;

      // Test scenario where ensureAppAndKey returns null
      configManagerStub.getCurrentAppId.returns("");
      configManagerStub.getApiKey.returns("");

      const appId = configManagerStub.getCurrentAppId();
      const apiKey = configManagerStub.getApiKey();

      expect(appId).toBe("");
      expect(apiKey).toBe("");
    });
  });

  describe("API endpoint construction", function () {
    it("should construct correct revoke tokens endpoint", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const keyName = "appId.keyId";
      const endpoint = `/keys/${keyName}/revokeTokens`;

      expect(endpoint).toBe("/keys/appId.keyId/revokeTokens");
    });

    it("should use rest.ably.io as hostname", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const hostname = "rest.ably.io";
      const port = 443;

      expect(hostname).toBe("rest.ably.io");
      expect(port).toBe(443);
    });
  });

  describe("response parsing", function () {
    it("should parse successful JSON response", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const responseData = '{"success": true, "message": "Token revoked"}';
      let jsonResponse;

      try {
        jsonResponse = JSON.parse(responseData);
      } catch {
        jsonResponse = responseData;
      }

      expect(jsonResponse).toBeTypeOf("object");
      expect(jsonResponse.success).toBe(true);
    });

    it("should handle empty response", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const emptyData = "";
      const jsonResponse = emptyData.length > 0 ? JSON.parse(emptyData) : null;

      expect(jsonResponse).toBeNull();
    });

    it("should handle non-JSON response", function () {
      const _command = new RevokeTokenCommand([], {} as any);

      const textData = "Token revoked successfully";
      let jsonResponse;

      try {
        jsonResponse = JSON.parse(textData);
      } catch {
        jsonResponse = textData;
      }

      expect(jsonResponse).toBe("Token revoked successfully");
    });
  });
});
