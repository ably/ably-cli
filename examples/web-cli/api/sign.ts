import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signCredentials, getSigningSecret } from "../server/sign-handler.js";

/**
 * Vercel Serverless Function: Sign credentials for terminal authentication
 *
 * This endpoint signs API keys with HMAC-SHA256 to create signed configs
 * that can be validated by the terminal server.
 *
 * Environment Variables Required:
 * - SIGNING_SECRET or TERMINAL_SERVER_SIGNING_SECRET
 *
 * Request Body:
 * - apiKey: string (required) - Ably API key in format "appId.keyId:secret"
 * - bypassRateLimit: boolean (optional) - Set to true for CI/testing
 *
 * Response:
 * - signedConfig: string - JSON-encoded config that was signed
 * - signature: string - HMAC-SHA256 hex signature
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get signing secret from environment
  const secret = getSigningSecret();

  if (!secret) {
    console.error("[/api/sign] Signing secret not configured");
    return res.status(500).json({ error: "Signing secret not configured" });
  }

  const { apiKey, bypassRateLimit } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "apiKey is required" });
  }

  // Use shared signing logic
  const result = signCredentials({ apiKey, bypassRateLimit }, secret);

  res.status(200).json(result);
}
