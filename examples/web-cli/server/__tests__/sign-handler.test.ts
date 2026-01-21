import { describe, it, expect } from "vitest";
import { signCredentials } from "../sign-handler";

describe("signCredentials()", () => {
  const TEST_SECRET = "test-secret-key";

  describe("endpoint configuration", () => {
    it("should include endpoint in signed config when provided", () => {
      const { signedConfig } = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
          endpoint: "https://custom.ably.io",
        },
        TEST_SECRET
      );

      const config = JSON.parse(signedConfig);
      expect(config.endpoint).toBe("https://custom.ably.io");
    });

    it("should include controlAPIHost in signed config when provided", () => {
      const { signedConfig } = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
          controlAPIHost: "https://control-api.ably.io",
        },
        TEST_SECRET
      );

      const config = JSON.parse(signedConfig);
      expect(config.controlAPIHost).toBe("https://control-api.ably.io");
    });

    it("should include both endpoint and controlAPIHost when provided", () => {
      const { signedConfig } = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
          endpoint: "https://custom.ably.io",
          controlAPIHost: "https://control-api.ably.io",
        },
        TEST_SECRET
      );

      const config = JSON.parse(signedConfig);
      expect(config.endpoint).toBe("https://custom.ably.io");
      expect(config.controlAPIHost).toBe("https://control-api.ably.io");
    });

    it("should not include endpoint/controlAPIHost when not provided", () => {
      const { signedConfig } = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
        },
        TEST_SECRET
      );

      const config = JSON.parse(signedConfig);
      expect(config.endpoint).toBeUndefined();
      expect(config.controlAPIHost).toBeUndefined();
    });

    it("should include standard fields along with endpoint config", () => {
      const { signedConfig } = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: true,
          endpoint: "https://custom.ably.io",
        },
        TEST_SECRET
      );

      const config = JSON.parse(signedConfig);
      expect(config.apiKey).toBe("test-key");
      expect(config.bypassRateLimit).toBe(true);
      expect(config.timestamp).toBeDefined();
      expect(config.endpoint).toBe("https://custom.ably.io");
    });

    it("should generate valid signature with endpoint in config", () => {
      const result = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
          endpoint: "https://custom.ably.io",
        },
        TEST_SECRET
      );

      expect(result.signature).toBeDefined();
      expect(result.signature).toHaveLength(64); // HMAC-SHA256 produces 64-char hex string
    });

    it("should produce different signatures with and without endpoint", () => {
      const withEndpoint = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
          endpoint: "https://custom.ably.io",
        },
        TEST_SECRET
      );

      const withoutEndpoint = signCredentials(
        {
          apiKey: "test-key",
          bypassRateLimit: false,
        },
        TEST_SECRET
      );

      expect(withEndpoint.signature).not.toBe(withoutEndpoint.signature);
    });
  });
});
