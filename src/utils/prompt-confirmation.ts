import * as readline from "node:readline";

import {
  getInteractiveReadline,
  runWithReadlineRestore,
} from "./readline-helper.js";

/**
 * Prompts the user for confirmation with a yes/no question.
 * Automatically appends a "[y/n]" or "[Y/n]" suffix based on the default value.
 * Accepts both "y" and "yes" as affirmative responses (case-insensitive).
 *
 * When invoked from the interactive REPL (`ABLY_INTERACTIVE_MODE=true`), this
 * function automatically pauses the REPL's readline, removes its line
 * listeners, runs the prompt, and restores everything afterwards — so callers
 * never need to wrap it in `runWithReadlineRestore` themselves.
 *
 * @param message - The confirmation message to display to the user
 * @param defaultValue - The value returned when the user presses Enter without typing (default: false).
 *   Note: SIGINT and close always resolve to false regardless of defaultValue, since cancellation should never confirm.
 * @returns Promise<boolean> - true if user confirms (y/yes), false otherwise
 */
export function promptForConfirmation(
  message: string,
  defaultValue: boolean = false,
): Promise<boolean> {
  return runWithReadlineRestore(
    () => promptForConfirmationInternal(message, defaultValue),
    getInteractiveReadline(),
  );
}

function promptForConfirmationInternal(
  message: string,
  defaultValue: boolean,
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Determine suffix based on default
  const suffix = defaultValue ? "[Y/n]" : "[y/n]";

  // Add suffix if not already present (check all variants)
  const promptMessage =
    message.includes("[yes/no]") ||
    message.includes("[y/n]") ||
    message.includes("[Y/N]") ||
    message.includes("[Y/n]") ||
    message.includes("[y/N]")
      ? message
      : `${message} ${suffix}`;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(result);
    };

    rl.on("SIGINT", () => {
      finish(false);
    });

    rl.on("close", () => {
      finish(false);
    });

    rl.question(promptMessage, (answer) => {
      const response = answer.toLowerCase().trim();
      // Empty input → use default value
      if (response === "") {
        finish(defaultValue);
        return;
      }
      finish(response === "y" || response === "yes");
    });
  });
}
