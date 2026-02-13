import crypto from "node:crypto";

/**
 * Credentials configuration for signing
 */
export interface CredentialConfig {
  apiKey: string;
  accessToken?: string;
  timestamp?: number;
  bypassRateLimit?: boolean;
  endpoint?: string;
  controlAPIHost?: string;
}

/**
 * Get the signing secret for E2E tests
 * Checks multiple environment variables in priority order
 */
export function getTestSecret(): string {
  const secret =
    process.env.TERMINAL_SERVER_SIGNING_SECRET || process.env.SIGNING_SECRET;

  if (!secret) {
    console.warn(
      "[Signing Helper] No signing secret found in environment. Using fallback dev secret.",
    );
    console.warn(
      "[Signing Helper] Set TERMINAL_SERVER_SIGNING_SECRET in .env for production parity.",
    );
    return "dev-test-secret-example-only";
  }

  return secret;
}

/**
 * Generate HMAC-SHA256 signature for a message
 * @param message - Message to sign
 * @param secret - Signing secret
 * @returns Hex-encoded signature
 */
export function generateSignature(message: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  return hmac.digest("hex");
}

/**
 * Create signed config for terminal authentication
 * @param credentials - Credential configuration
 * @param secret - Signing secret (defaults to environment variable)
 * @returns Object with signedConfig (JSON string) and signature (hex string)
 */
export function createSignedConfig(
  credentials: CredentialConfig,
  secret?: string,
): { signedConfig: string; signature: string } {
  const signingSecret = secret || getTestSecret();

  // Build config object (matches terminal server expectations)
  const config: Record<string, unknown> = {
    apiKey: credentials.apiKey,
    timestamp: credentials.timestamp || Date.now(),
  };

  if (credentials.accessToken) {
    config.accessToken = credentials.accessToken;
  }

  if (credentials.bypassRateLimit !== undefined) {
    config.bypassRateLimit = credentials.bypassRateLimit;
  }

  if (credentials.endpoint) {
    config.endpoint = credentials.endpoint;
  }

  if (credentials.controlAPIHost) {
    config.controlAPIHost = credentials.controlAPIHost;
  }

  // Serialize to JSON string - this exact string is what gets signed
  const signedConfig = JSON.stringify(config);

  // Generate HMAC-SHA256 signature
  const signature = generateSignature(signedConfig, signingSecret);

  return { signedConfig, signature };
}

/**
 * Check if signing is available (secret is configured)
 */
export function isSigningAvailable(): boolean {
  return !!(
    process.env.TERMINAL_SERVER_SIGNING_SECRET || process.env.SIGNING_SECRET
  );
}

/**
 * Log signing configuration status for debugging
 */
export function logSigningStatus(): void {
  const hasTerminalSecret = !!process.env.TERMINAL_SERVER_SIGNING_SECRET;
  const hasSigningSecret = !!process.env.SIGNING_SECRET;
  const hasCISecret = !!process.env.CI_BYPASS_SECRET;

  console.log("[Signing Helper] Configuration:", {
    TERMINAL_SERVER_SIGNING_SECRET: hasTerminalSecret ? "SET" : "NOT SET",
    SIGNING_SECRET: hasSigningSecret ? "SET" : "NOT SET",
    usingSecret: hasTerminalSecret
      ? "TERMINAL_SERVER_SIGNING_SECRET"
      : hasSigningSecret
        ? "SIGNING_SECRET"
        : hasCISecret
          ? "CI_BYPASS_SECRET"
          : "fallback",
  });
}
