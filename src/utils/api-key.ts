/**
 * Ably API keys have the shape `APP_ID.KEY_ID:KEY_SECRET`.
 */

export function extractAppIdFromApiKey(apiKey: string): string {
  return apiKey.split(".")[0] ?? "";
}

/**
 * Returns the "key name" portion — everything before the `:` separator
 * (i.e. `APP_ID.KEY_ID`). Empty string if the input is not a valid key.
 */
export function extractKeyNameFromApiKey(apiKey: string): string {
  return apiKey.split(":")[0] ?? "";
}
