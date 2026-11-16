import { Command, Interfaces } from "@oclif/core";
import isTestMode from "./utils/test-mode.js";
import { format } from "node:util";

import {
  escapeControlChars,
  stripUnsafeEscapes,
} from "./utils/terminal-safe.js";

type PrettyPrintableError = Interfaces.PrettyPrintableError;

/**
 * The error thrown in place of exiting the process, in test and interactive
 * mode.
 *
 * It carries oclif's `exit` metadata for the same reason `error()` below does:
 * an exit is a decision that has already been reported to the user, so any
 * catch block it unwinds through — `runControlCommand`, a command's own
 * try/catch — must re-throw it rather than reporting it a second time.
 */
function exitError(code: number): Error {
  const error = new Error(`Command exited with code ${code}`);
  return Object.assign(error, {
    code: "EEXIT",
    exitCode: code,
    oclif: { exit: code },
  });
}

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
          stripUnsafeEscapes(error.message),
        );
      }
      throw error;
    }

    // In normal mode or when exit is false, use default behavior
    if (options?.exit === false) {
      return super.error(
        input,
        options as { code?: string; exit: false } & PrettyPrintableError,
      );
    }
    return super.error(
      input,
      options as { code?: string; exit?: number } & PrettyPrintableError,
    );
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
      if (code !== 0) {
        throw exitError(code);
      }
      // @ts-expect-error TS2322: suppress type assignment error — success exit is a no-op in tests
      return;
    }

    if (process.env.ABLY_INTERACTIVE_MODE === "true") {
      throw exitError(code);
    }

    super.exit(code);
  }

  /**
   * Override log to ensure proper output in interactive mode.
   *
   * Every line passes through `stripUnsafeEscapes()`, so a remote value that
   * reached output without going through a formatter still cannot clear the
   * screen, move the cursor, set the title, or write links or the clipboard.
   * Colours (SGR) are kept. Deliberate terminal control (screen clears in
   * bench, inline typing updates) uses process.stdout.write directly.
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
      console.log(stripUnsafeEscapes(format(message, ...args)));
    }
  }

  logToStderr(message = "", ...args: unknown[]): void {
    super.logToStderr(stripUnsafeEscapes(format(message, ...args)));
  }

  /**
   * Errors that leave run() reach oclif's handler, which prints the message
   * (or, with DEBUG set, the stack, which embeds the original message) with
   * console.error, past log() and the formatters. Anything not already shaped
   * by oclif (fail() goes through this.error(), so its CLIError is) is an SDK
   * or runtime error whose message may echo remote values: escape it visibly.
   * oclif-shaped messages keep their colours but lose every other escape
   * sequence. Non-Error throws (including null/undefined) go to oclif as-is.
   */
  protected override async catch(
    err: Interfaces.CommandError,
  ): Promise<unknown> {
    if (err instanceof Error) {
      const sanitize = "oclif" in err ? stripUnsafeEscapes : escapeControlChars;
      err.message = sanitize(err.message);
      if (typeof err.stack === "string") err.stack = sanitize(err.stack);
    }
    return super.catch(err);
  }
}
