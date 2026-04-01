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
        href?: string;
      };

      // Duck-type Ably ErrorInfo: has numeric code and statusCode
      if (
        typeof errWithCode.code === "number" &&
        typeof errWithCode.statusCode === "number"
      ) {
        const errorContext: Record<string, unknown> = { ...context };
        if (typeof errWithCode.href === "string") {
          errorContext.helpUrl = errWithCode.href;
        }
        return new CommandError(error.message, {
          code: errWithCode.code,
          statusCode: errWithCode.statusCode,
          context: errorContext,
          cause: error,
        });
      }

      // Error with numeric .code only
      if (typeof errWithCode.code === "number") {
        const errorContext: Record<string, unknown> = { ...context };
        if (typeof errWithCode.href === "string") {
          errorContext.helpUrl = errWithCode.href;
        }
        return new CommandError(error.message, {
          code: errWithCode.code,
          context: errorContext,
          cause: error,
        });
      }

      return new CommandError(error.message, { context, cause: error });
    }

    // Duck-type plain objects with a message property (e.g., parsed JSON error bodies)
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as Record<string, unknown>).message === "string"
    ) {
      const obj = error as Record<string, unknown>;
      return new CommandError(obj.message as string, {
        code: typeof obj.code === "number" ? obj.code : undefined,
        statusCode:
          typeof obj.statusCode === "number" ? obj.statusCode : undefined,
        context,
      });
    }

    if (typeof error === "string") {
      return new CommandError(error, { context });
    }

    return new CommandError(String(error), { context });
  }

  /**
   * Create a CommandError from an HttpPaginatedResponse error.
   * Extracts errorCode, errorMessage, and statusCode from the response.
   */
  static fromHttpResponse(
    response: {
      statusCode: number;
      errorCode?: number | null;
      errorMessage?: string | null;
    },
    action: string,
  ): CommandError {
    const message =
      response.errorMessage || `${action} (status ${response.statusCode})`;
    return new CommandError(message, {
      code: response.errorCode || undefined,
      statusCode: response.statusCode,
    });
  }

  /** Produce JSON-safe data for the error envelope */
  toJsonData(hint?: string): Record<string, unknown> {
    const errorObj: Record<string, unknown> = {
      message: this.message,
      ...(this.code === undefined ? {} : { code: this.code }),
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
      ...(hint === undefined ? {} : { hint }),
    };
    return {
      ...this.context,
      error: errorObj,
    };
  }
}
