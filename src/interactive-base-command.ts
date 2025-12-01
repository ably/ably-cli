import { Command, Interfaces } from "@oclif/core";
import isTestMode from "./utils/test-mode.js";

type PrettyPrintableError = Interfaces.PrettyPrintableError;

/**
 * Base command class that provides interactive-mode-safe error handling.
 * When running in interactive mode, this class converts process.exit calls
 * to thrown errors that can be caught and handled gracefully.
 */
export abstract class InteractiveBaseCommand extends Command {
  /**
   * Override error to throw instead of exit in interactive mode
   */
  error(
    input: string | Error,
    options: { code?: string; exit: false } & PrettyPrintableError,
  ): void;
  error(
    input: string | Error,
    options?: { code?: string; exit?: number } & PrettyPrintableError,
  ): never;
  error(
    input: string | Error,
    options?: { code?: string; exit?: number | false } & PrettyPrintableError,
  ): void | never {
    const error = typeof input === "string" ? new Error(input) : input;

    // In interactive mode, throw the error to be caught
    if (
      process.env.ABLY_INTERACTIVE_MODE === "true" &&
      options?.exit !== false
    ) {
      // Add oclif error metadata
      (error as Error & { oclif?: { exit?: number; code?: string } }).oclif = {
        exit: options?.exit ?? 1,
        code: options?.code,
      };

      if (process.env.DEBUG) {
        console.error(
          "[InteractiveBaseCommand] Throwing error instead of exiting:",
          error.message,
        );
      }
      throw error;
    }

    // In normal mode or when exit is false, use default behavior
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return super.error(input, options as any);
  }

  /**
   * Exit is an override of oclif's exit command.
   *
   * If we're running unit tests, it does nothing, because we don't want to
   * quit the test process.
   *
   * If we're running in interactive mode, we want to throw instead of killing the process.
   *
   * Otherwise, defer to oclif to kill off the process.
   */
  exit(code = 0): never {
    if (isTestMode()) {
      // @ts-expect-error TS2322: suppress type assignment error
      return;
    }

    if (process.env.ABLY_INTERACTIVE_MODE === "true") {
      const error = new Error(`Command exited with code ${code}`);
      (error as Error & { exitCode?: number; code?: string }).exitCode = code;
      (error as Error & { exitCode?: number; code?: string }).code = "EEXIT";
      throw error;
    }

    super.exit(code);
  }

  /**
   * Override log to ensure proper output in interactive mode
   */
  log(message?: string, ...args: unknown[]): void {
    // If we have this, the command wasn't run in oclif.runCommand, so don't log to avoid polluting.
    if (!this.config.root) {
      return;
    }

    // Ensure logs are displayed properly in interactive mode
    if (message === undefined) {
      console.log();
    } else {
      console.log(message, ...args);
    }
  }
}
