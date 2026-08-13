/**
 * Ably API keys have the shape `APP_ID.KEY_ID:KEY_SECRET`.
 */

export function extractAppIdFromApiKey(apiKey: string): string {
  return apiKey.split(".")[0] ?? "";
}

/**
 * True when the value has the full `APP_ID.KEY_ID:KEY_SECRET` shape.
 *
 * `extractAppIdFromApiKey` is deliberately lenient — it returns the whole
 * string for input with no separators — so callers that accept a key straight
 * from the user should check the shape first.
 */
export function isValidApiKey(apiKey: string): boolean {
  return /^[^\s.:]+\.[^\s.:]+:\S+$/.test(apiKey);
}

/**
 * Returns the "key name" portion — everything before the `:` separator
 * (i.e. `APP_ID.KEY_ID`). Empty string if the input is not a valid key.
 */
export function extractKeyNameFromApiKey(apiKey: string): string {
  return apiKey.split(":")[0] ?? "";
}
