import * as readline from "node:readline";

/**
 * Prompts the user for confirmation with a yes/no question.
 * Automatically appends " [y/n]" to the message if not already present.
 * Accepts both "y" and "yes" as affirmative responses (case-insensitive).
 *
 * @param message - The confirmation message to display to the user
 * @returns Promise<boolean> - true if user confirms (y/yes), false otherwise
 */
export function promptForConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Add " [y/n]" suffix if not already present
  const promptMessage =
    message.includes("[yes/no]") ||
    message.includes("[y/n]") ||
    message.includes("[Y/N]")
      ? message
      : `${message} [y/n]`;

  return new Promise<boolean>((resolve) => {
    rl.question(promptMessage, (answer) => {
      rl.close();
      const response = answer.toLowerCase().trim();
      resolve(response === "y" || response === "yes");
    });
  });
}
