/**
 * Extract a human-readable message from an unknown error value.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Ably error code to enhanced error message mapping.
 * These provide more helpful CLI-specific guidance for common errors.
 */
const ABLY_ERROR_ENHANCEMENTS: Record<
  number,
  { hint: string; helpUrl?: string }
> = {
  // Mutable messages feature not enabled (required for annotations, updates, deletes, appends)
  93002: {
    hint: 'Enable the "Message annotations, updates, deletes, and appends" channel rule:\n  1. Go to your app\'s Settings tab in the Ably dashboard\n  2. Under Channel rules, click "Add new rule"\n  3. Enter the channel namespace (e.g., the part before ":" in your channel name)\n  4. Check "Message annotations, updates, deletes, and appends"\n  5. Click "Create channel rule"',
    helpUrl: "https://ably.com/docs/messages/annotations#enable",
  },
};

/**
 * Extract the Ably error code from an error object.
 * Ably SDK errors have a `code` property.
 */
export function getAblyErrorCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "number") {
      return code;
    }
  }
  return undefined;
}

/**
 * Enhance an error message with CLI-specific guidance if the error
 * is a known Ably error code.
 *
 * @param error - The error object
 * @param baseMessage - The base error message
 * @returns Enhanced error message with hints, or the original message
 */
export function enhanceErrorMessage(
  error: unknown,
  baseMessage: string,
): string {
  const errorCode = getAblyErrorCode(error);
  if (errorCode && ABLY_ERROR_ENHANCEMENTS[errorCode]) {
    const enhancement = ABLY_ERROR_ENHANCEMENTS[errorCode];
    let enhanced = `${baseMessage}\n\nHint: ${enhancement.hint}`;
    if (enhancement.helpUrl) {
      enhanced += `\n\nFor more information, see: ${enhancement.helpUrl}`;
    }
    return enhanced;
  }
  return baseMessage;
}
