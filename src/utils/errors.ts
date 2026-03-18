/**
 * Extract a human-readable message from an unknown error value.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Return a friendly, actionable hint for known Ably error codes.
 * Returns undefined for unknown codes.
 */
const hints: Record<number, string> = {
  40101:
    'The credentials provided are not valid. Check your API key or token, or re-authenticate with "ably login".',
  40103: 'The token has expired. Please re-authenticate with "ably login".',
  40110:
    'Unable to authorize. Check your authentication configuration or re-authenticate with "ably login".',
  40160:
    'Run "ably auth keys list" to check your key\'s capabilities for this resource, or update them in the Ably dashboard.',
  40161:
    'Run "ably auth keys list" to check your key\'s publish capability, or update it in the Ably dashboard.',
  40171:
    'Run "ably auth keys list" to check your key\'s capabilities, or update them in the Ably dashboard.',
};

export function getFriendlyAblyErrorHint(code?: number): string | undefined {
  if (code === undefined) return undefined;
  return hints[code];
}
