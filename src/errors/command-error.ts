/**
 * Structured error type for CLI commands.
 * Preserves Ably error codes and HTTP status codes through the error pipeline.
 */
export class CommandError extends Error {
  readonly code?: number;
  readonly statusCode?: number;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    opts?: {
      code?: number;
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "CommandError";
    this.code = opts?.code;
    this.statusCode = opts?.statusCode;
    this.context = opts?.context ?? {};
  }

  /**
   * Extract structured data from any error type:
   * - CommandError → pass through (merge context)
   * - Ably ErrorInfo (duck-typed: has code + statusCode) → extract structured fields
   * - Error with .code property → extract code
   * - Plain Error → message only
   * - string → wrap in CommandError
   * - unknown → String(error)
   */
  static from(error: unknown, context?: Record<string, unknown>): CommandError {
    if (error instanceof CommandError) {
      // Merge additional context if provided
      if (context && Object.keys(context).length > 0) {
        return new CommandError(error.message, {
          code: error.code,
          statusCode: error.statusCode,
          context: { ...error.context, ...context },
          cause: error.cause instanceof Error ? error.cause : undefined,
        });
      }
      return error;
    }

    if (error instanceof Error) {
      const errWithCode = error as Error & {
        code?: number | string;
        statusCode?: number;
      };

      // Duck-type Ably ErrorInfo: has numeric code and statusCode
      if (
        typeof errWithCode.code === "number" &&
        typeof errWithCode.statusCode === "number"
      ) {
        return new CommandError(error.message, {
          code: errWithCode.code,
          statusCode: errWithCode.statusCode,
          context,
          cause: error,
        });
      }

      // Error with numeric .code only
      if (typeof errWithCode.code === "number") {
        return new CommandError(error.message, {
          code: errWithCode.code,
          context,
          cause: error,
        });
      }

      return new CommandError(error.message, { context, cause: error });
    }

    if (typeof error === "string") {
      return new CommandError(error, { context });
    }

    return new CommandError(String(error), { context });
  }

  /** Produce JSON-safe data for the error envelope */
  toJsonData(): Record<string, unknown> {
    return {
      error: this.message,
      ...(this.code === undefined ? {} : { code: this.code }),
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
      ...this.context,
    };
  }
}
