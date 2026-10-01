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
  href?: string;
} {
  if (error instanceof Error) {
    const errWithCode = error as Error & {
      code?: number | string;
      statusCode?: number;
      href?: string;
    };
    const result: {
      message: string;
      code?: number;
      statusCode?: number;
      href?: string;
    } = {
      message: error.message,
    };
    if (typeof errWithCode.code === "number") {
      result.code = errWithCode.code;
    }
    if (typeof errWithCode.statusCode === "number") {
      result.statusCode = errWithCode.statusCode;
    }
    if (typeof errWithCode.href === "string") {
      result.href = errWithCode.href;
    }
    return result;
  }
  return { message: String(error) };
}

/**
 * Build an Error with a CLI-facing message that keeps the Ably code, status
 * code and help URL of the underlying reason, so `fail()` can still attach
 * the code and its hint.
 */
export function errorWithReason(
  message: string,
  reason?: { code?: number; statusCode?: number; href?: string } | null,
): Error {
  return Object.assign(new Error(message), {
    code: reason?.code,
    statusCode: reason?.statusCode,
    href: reason?.href,
  });
}

/** What a hint may depend on: how the CLI authenticated and its flags. */
export interface HintContext {
  /** Authenticating with ABLY_TOKEN, so the client ID comes from the token. */
  tokenAuth?: boolean;
  /** The command declares the identity --client-id flag. */
  hasClientIdFlag?: boolean;
}

type Hint = string | ((context: HintContext) => string);

const tokenExpiredHint =
  "Generate a new token or use an API key instead. See https://ably.com/docs/auth for details.";

const reissueTokenHint =
  'The client ID comes from your token: re-issue it with one, e.g. "ably auth issue-jwt-token --client-id <id>".';

function clientIdSources({ hasClientIdFlag }: HintContext): string {
  return hasClientIdFlag
    ? "--client-id or the ABLY_CLIENT_ID environment variable"
    : "the ABLY_CLIENT_ID environment variable";
}

const clientIdHint: Hint = (context) =>
  context.tokenAuth
    ? reissueTokenHint
    : `Set a client ID with ${clientIdSources(context)}.`;

const invalidClientIdHint: Hint = (context) =>
  context.tokenAuth
    ? reissueTokenHint
    : `Set a valid client ID (not empty and not "*") with ${clientIdSources(context)}.`;

/**
 * Return a friendly, actionable hint for known Ably error codes.
 * Returns undefined for unknown codes.
 */
const hints: Record<number, Hint> = {
  40012: invalidClientIdHint,
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

export function getFriendlyAblyErrorHint(
  code?: number,
  context: HintContext = {},
): string | undefined {
  if (code === undefined) return undefined;
  const hint = hints[code];
  return typeof hint === "function" ? hint(context) : hint;
}
