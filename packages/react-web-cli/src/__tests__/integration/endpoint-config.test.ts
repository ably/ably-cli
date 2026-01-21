import { describe, it, expect } from "vitest";
import { createAuthPayload } from "../../terminal-shared";
import crypto from "node:crypto";

/**
 * Integration test for endpoint configuration flow
 * Tests the complete flow from signing to auth payload creation
 */

// Simulate the signCredentials function from examples/web-cli/server/sign-handler.ts
function signCredentials(
  request: {
    apiKey: string;
    bypassRateLimit?: boolean;
    endpoint?: string;
    controlAPIHost?: string;
  },
  secret: string,
): { signedConfig: string; signature: string } {
  const { apiKey, bypassRateLimit, endpoint, controlAPIHost } = request;

  const config = {
    apiKey,
    timestamp: Date.now(),
    bypassRateLimit: bypassRateLimit || false,
    ...(endpoint && { endpoint }),
    ...(controlAPIHost && { controlAPIHost }),
  };

  const configString = JSON.stringify(config);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(configString);
  const signature = hmac.digest("hex");

  return {
    signedConfig: configString,
    signature,
  };
}

describe("Endpoint Configuration Integration", () => {
  const TEST_SECRET = "test-secret-key";

  it("should pass custom endpoint through signing to auth payload", () => {
    const customEndpoint = "https://staging.ably.io";
    const customControlAPI = "https://control-staging.ably.io";

    // 1. Sign credentials with endpoint
    const { signedConfig, signature } = signCredentials(
      {
        apiKey: "test-key",
        bypassRateLimit: false,
        endpoint: customEndpoint,
        controlAPIHost: customControlAPI,
      },
      TEST_SECRET,
    );

    // 2. Create auth payload
    const payload = createAuthPayload("session-123", signedConfig, signature);

    // 3. Verify endpoint is in environment variables
    expect(payload.environmentVariables.ABLY_ENDPOINT).toBe(customEndpoint);
    expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBe(
      customControlAPI,
    );
  });

  it("should work without endpoint configuration", () => {
    // 1. Sign credentials without endpoint
    const { signedConfig, signature } = signCredentials(
      {
        apiKey: "test-key",
        bypassRateLimit: false,
      },
      TEST_SECRET,
    );

    // 2. Create auth payload
    const payload = createAuthPayload("session-123", signedConfig, signature);

    // 3. Verify endpoint is not in environment variables
    expect(payload.environmentVariables.ABLY_ENDPOINT).toBeUndefined();
    expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBeUndefined();

    // 4. Verify standard env vars are still present
    expect(payload.environmentVariables.ABLY_WEB_CLI_MODE).toBe("true");
    expect(payload.environmentVariables.PS1).toBe("ably> ");
  });

  it("should handle only endpoint without controlAPIHost", () => {
    const customEndpoint = "https://staging.ably.io";

    const { signedConfig, signature } = signCredentials(
      {
        apiKey: "test-key",
        bypassRateLimit: false,
        endpoint: customEndpoint,
      },
      TEST_SECRET,
    );

    const payload = createAuthPayload("session-123", signedConfig, signature);

    expect(payload.environmentVariables.ABLY_ENDPOINT).toBe(customEndpoint);
    expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBeUndefined();
  });

  it("should handle only controlAPIHost without endpoint", () => {
    const customControlAPI = "https://control-staging.ably.io";

    const { signedConfig, signature } = signCredentials(
      {
        apiKey: "test-key",
        bypassRateLimit: false,
        controlAPIHost: customControlAPI,
      },
      TEST_SECRET,
    );

    const payload = createAuthPayload("session-123", signedConfig, signature);

    expect(payload.environmentVariables.ABLY_ENDPOINT).toBeUndefined();
    expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBe(
      customControlAPI,
    );
  });

  it("should preserve signature integrity with endpoint in config", () => {
    const request = {
      apiKey: "test-key",
      bypassRateLimit: false,
      endpoint: "https://staging.ably.io",
    };

    const { signedConfig, signature } = signCredentials(request, TEST_SECRET);

    // Verify signature by recomputing it
    const hmac = crypto.createHmac("sha256", TEST_SECRET);
    hmac.update(signedConfig);
    const recomputedSignature = hmac.digest("hex");

    expect(signature).toBe(recomputedSignature);
  });

  it("should maintain backward compatibility when endpoint is not provided", () => {
    // Old-style request without endpoint
    const oldStyleRequest = {
      apiKey: "test-key",
      bypassRateLimit: true,
    };

    const { signedConfig, signature } = signCredentials(
      oldStyleRequest,
      TEST_SECRET,
    );
    const payload = createAuthPayload("session-456", signedConfig, signature);

    // Verify old behavior still works
    expect(payload.config).toBe(signedConfig);
    expect(payload.signature).toBe(signature);
    expect(payload.apiKey).toBe("test-key");

    // Verify no endpoint vars are added
    expect(payload.environmentVariables.ABLY_ENDPOINT).toBeUndefined();
    expect(payload.environmentVariables.ABLY_CONTROL_API_HOST).toBeUndefined();

    // Verify standard vars still present
    expect(payload.environmentVariables.ABLY_WEB_CLI_MODE).toBe("true");
  });
});
