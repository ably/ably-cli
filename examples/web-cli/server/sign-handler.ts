import crypto from "crypto";

/**
 * Shared signing logic for credential authentication
 * Used by: Vercel function, Vite middleware, and preview server
 */

export interface SignRequest {
  apiKey: string;
  bypassRateLimit?: boolean;
}

export interface SignResponse {
  signedConfig: string;
  signature: string;
}

/**
 * Sign credentials using HMAC-SHA256
 * @param request - Request containing apiKey and optional flags
 * @param secret - Signing secret from environment
 * @returns Signed config and signature
 */
export function signCredentials(
  request: SignRequest,
  secret: string,
): SignResponse {
  const { apiKey, bypassRateLimit } = request;

  // Build config object (matches terminal server expectations)
  const config = {
    apiKey,
    timestamp: Date.now(),
    bypassRateLimit: bypassRateLimit || false,
  };

  // Serialize to JSON - this exact string is what gets signed
  const configString = JSON.stringify(config);

  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(configString);
  const signature = hmac.digest("hex");

  return {
    signedConfig: configString,
    signature,
  };
}

/**
 * Get signing secret from environment variables
 * Checks multiple variable names for compatibility
 */
export function getSigningSecret(): string | null {
  return (
    process.env.TERMINAL_SERVER_SIGNING_SECRET ||
    process.env.SIGNING_SECRET ||
    null
  );
}
