/**
 * Extract a human-readable message from an unknown error value.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extract structured error info from an unknown error value.
 * Returns an object matching the Ably ErrorInfo shape: { message, code?, statusCode? }.
 * Suitable for embedding in JSON output as an `error` field.
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  code?: number;
  statusCode?: number;
} {
  if (error instanceof Error) {
    const errWithCode = error as Error & {
      code?: number | string;
      statusCode?: number;
    };
    const result: { message: string; code?: number; statusCode?: number } = {
      message: error.message,
    };
    if (typeof errWithCode.code === "number") {
      result.code = errWithCode.code;
    }
    if (typeof errWithCode.statusCode === "number") {
      result.statusCode = errWithCode.statusCode;
    }
    return result;
  }
  return { message: String(error) };
}

/**
 * Return a friendly, actionable hint for known Ably error codes.
 * Returns undefined for unknown codes.
 */
const clientIdHint = "Use the --client-id flag to set a client identity.";
const tokenExpiredHint =
  "Generate a new token or use an API key instead. See https://ably.com/docs/auth for details.";

const hints: Record<number, string> = {
  40101: 'Check your API key or token, or re-authenticate with "ably login".',
  40103:
    "This is unexpected - TLS is enabled by default. Please report this issue at https://ably.com/support",
  40110:
    "Check your account status in the Ably dashboard at https://ably.com/dashboard",
  40120:
    "Check the app status in the Ably dashboard at https://ably.com/dashboard",
  40142: tokenExpiredHint,
  40160:
    'Run "ably auth keys list" to check your key\'s capabilities for this resource, or update them in the Ably dashboard.',
  40161: clientIdHint,
  40171: tokenExpiredHint,
  40300:
    "Check your account and app status in the Ably dashboard at https://ably.com/dashboard",
  80003: "Check your network connection and try again.",
  91000: clientIdHint,
};

export function getFriendlyAblyErrorHint(code?: number): string | undefined {
  if (code === undefined) return undefined;
  return hints[code];
}
