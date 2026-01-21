import { describe, it, expect } from "vitest";
import { createAuthPayload } from "./terminal-shared";

describe("createAuthPayload()", () => {
  describe("endpoint configuration", () => {
    it("should extract endpoint from signed config and add to environment variables", () => {
      const signedConfig = JSON.stringify({
        apiKey: "test-key",
        timestamp: Date.now(),
        endpoint: "https://custom.ably.io",
      });

      const payload = createAuthPayload(
        "session-123",
        signedConfig,
        "signature",
      );

      expect(payload.environmentVariables.ABLY_ENDPOINT).toBe(
        "https://custom.ably.io",
      );
    });

    it("should extract controlAPIHost from signed config and add to environment variables", () => {
      const signedConfig = JSON.stringify({
        apiKey: "test-key",
        timestamp: Date.now(),
        controlAPIHost: "https://control-api.ably.io",
      });

      const payload = createAuthPayload(
        "session-123",
        signedConfig,
        "signature",
      );

      expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBe(
        "https://control-api.ably.io",
      );
    });

    it("should handle both endpoint and controlAPIHost together", () => {
      const signedConfig = JSON.stringify({
        apiKey: "test-key",
        timestamp: Date.now(),
        endpoint: "https://custom.ably.io",
        controlAPIHost: "https://control-api.ably.io",
      });

      const payload = createAuthPayload(
        "session-123",
        signedConfig,
        "signature",
      );

      expect(payload.environmentVariables.ABLY_ENDPOINT).toBe(
        "https://custom.ably.io",
      );
      expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBe(
        "https://control-api.ably.io",
      );
    });

    it("should not add endpoint environment variables when not present in config", () => {
      const signedConfig = JSON.stringify({
        apiKey: "test-key",
        timestamp: Date.now(),
      });

      const payload = createAuthPayload(
        "session-123",
        signedConfig,
        "signature",
      );

      expect(payload.environmentVariables.ABLY_ENDPOINT).toBeUndefined();
      expect(
        payload.environmentVariables.ABLY_CONTROL_API_HOST,
      ).toBeUndefined();
    });

    it("should include base environment variables regardless of endpoint config", () => {
      const signedConfig = JSON.stringify({
        apiKey: "test-key",
        timestamp: Date.now(),
        endpoint: "https://custom.ably.io",
      });

      const payload = createAuthPayload(
        "session-123",
        signedConfig,
        "signature",
      );

      expect(payload.environmentVariables.ABLY_WEB_CLI_MODE).toBe("true");
      expect(payload.environmentVariables.PS1).toBe("ably> ");
      expect(payload.environmentVariables.ABLY_ENDPOINT).toBe(
        "https://custom.ably.io",
      );
    });

    it("should extract apiKey and accessToken along with endpoint config", () => {
      const signedConfig = JSON.stringify({
        apiKey: "test-key-123",
        accessToken: "test-token-456",
        timestamp: Date.now(),
        endpoint: "https://custom.ably.io",
        controlAPIHost: "https://control-api.ably.io",
      });

      const payload = createAuthPayload(
        "session-123",
        signedConfig,
        "signature",
      );

      expect(payload.apiKey).toBe("test-key-123");
      expect(payload.accessToken).toBe("test-token-456");
      expect(payload.environmentVariables.ABLY_ENDPOINT).toBe(
        "https://custom.ably.io",
      );
      expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBe(
        "https://control-api.ably.io",
      );
    });
  });
});
