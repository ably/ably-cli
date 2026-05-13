import * as readline from "node:readline";

/**
 * Prompts the user for confirmation with a yes/no question.
 * Accepts both "y" and "yes" as affirmative responses (case-insensitive).
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

  return new Promise<boolean>((resolve) => {
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
