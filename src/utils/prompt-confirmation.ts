import * as readline from "node:readline";

/** Rejection reason when the user presses Ctrl+C at a confirmation prompt. */
export class InterruptError extends Error {
  constructor() {
    super("Interrupted by user");
    this.name = "InterruptError";
  }
}

/**
 * Prompts the user for confirmation with a yes/no question.
 * Accepts both "y" and "yes" as affirmative responses (case-insensitive).
 *
 * Ctrl+C rejects with an `InterruptError` rather than answering "no", because
 * some callers carry on with their flow when the answer is no.
 *
 * @param message - The confirmation message to display to the user
 * @param options.defaultYes - If true, an empty answer counts as yes and the
 *   default suffix becomes " [Y/n]". Use only for non-destructive prompts.
 * @returns Promise<boolean> - true if user confirms, false otherwise
 */
export function promptForConfirmation(
  message: string,
  options: { defaultYes?: boolean } = {},
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = options.defaultYes ? "[Y/n]" : "[y/n]";
  const promptMessage =
    message.includes("[yes/no]") ||
    message.includes("[y/n]") ||
    message.includes("[Y/n]") ||
    message.includes("[Y/N]")
      ? message
      : `${message} ${suffix}`;

  return new Promise<boolean>((resolve, reject) => {
    // Without a SIGINT listener, readline handles Ctrl+C by silently closing
    // the interface, leaving this promise pending forever. Inside
    // `ably interactive` nothing else then keeps the event loop alive, so Node
    // drains it and the whole shell exits with code 0.
    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write("\n");
      reject(new InterruptError());
    });

    rl.question(promptMessage, (answer) => {
      rl.close();
      const response = answer.toLowerCase().trim();
      if (response === "") {
        resolve(Boolean(options.defaultYes));
        return;
      }
      resolve(response === "y" || response === "yes");
    });
  });
}
