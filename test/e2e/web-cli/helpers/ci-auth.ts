import crypto from "node:crypto";

/**
 * Payload structure for CI authentication
 */
export interface CIAuthPayload {
  timestamp: number;
  testGroup?: string;
  runId?: string;
}

/**
 * Generate a HMAC-based authentication token for CI rate limit bypass
 * @param secret - Shared secret from environment
 * @param payload - Authentication payload containing timestamp and metadata
 * @returns Base64 encoded token containing payload and signature
 */
export function generateCIAuthToken(
  secret: string,
  payload: CIAuthPayload,
): string {
  // Create a canonical string representation
  const message = JSON.stringify({
    timestamp: payload.timestamp,
    testGroup: payload.testGroup || "default",
    runId: payload.runId || "local",
  });

  // Generate HMAC-SHA256
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  const signature = hmac.digest("hex");

  // Return base64 encoded token
  return Buffer.from(
    JSON.stringify({
      payload,
      signature,
    }),
  ).toString("base64");
}

/**
 * Check if TERMINAL_SERVER_SIGNING_SECRET is set in environment
 * @returns true if CI mode is enabled and signing secret is available, false otherwise
 */
export function shouldUseTerminalServerSigningSecret(): boolean {
  return !!process.env.TERMINAL_SERVER_SIGNING_SECRET;
}

/**
 * Get the WebSocket URL to use (production or local)
 * @returns WebSocket URL from environment or default production URL
 */
export function getCIWebSocketUrl(): string {
  return (
    process.env.TERMINAL_SERVER_URL || "wss://web-cli-terminal.ably-dev.com"
  );
}
