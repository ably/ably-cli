/**
 * Parse a key identifier that may be in APP_ID.KEY_ID format.
 * Returns the extracted appId (if present) and keyId.
 */
export function parseKeyIdentifier(identifier: string): {
  appId?: string;
  keyId: string;
} {
  if (identifier.includes(".")) {
    const parts = identifier.split(".");
    // If it has exactly one period and no colon, it's likely an app_id.key_id
    if (parts.length === 2 && !identifier.includes(":")) {
      return { appId: parts[0]!, keyId: parts[1]! };
    }
  }
  return { keyId: identifier };
}

/**
 * Resolve a current key ID into a full key name (appId.keyId).
 * Handles the case where keyId may already include the appId prefix.
 * Returns undefined if keyId is not provided.
 */
export function resolveCurrentKeyName(
  appId: string,
  keyId?: string,
): string | undefined {
  if (!keyId) return undefined;
  return keyId.includes(".") ? keyId : `${appId}.${keyId}`;
}

/**
 * Parse a capabilities string that may be either:
 * - JSON object: '{"channel1":["publish"],"channel2":["subscribe"]}'
 * - Comma-separated list: "publish,subscribe" → {"*": ["publish","subscribe"]}
 *
 * Throws error on invalid JSON object or empty Capabilities array
 */
export function parseCapabilities(input: string): Record<string, string[]> {
  if (input.trimStart().startsWith("{")) {
    try {
      return JSON.parse(input) as Record<string, string[]>;
    } catch (error) {
      throw new Error(
        "Invalid capabilities JSON format. Please provide a valid JSON string.",
        { cause: error },
      );
    }
  }

  const capabilityArray = input
    .split(",")
    .map((cap) => cap.trim())
    .filter((cap) => cap.length > 0);

  if (capabilityArray.length === 0) {
    throw new Error(
      "Capabilities must contain at least one non-empty capability.",
    );
  }

  return { "*": capabilityArray };
}
