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
