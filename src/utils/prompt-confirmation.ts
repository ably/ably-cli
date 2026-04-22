import * as readline from "node:readline";

/**
 * Prompts the user for confirmation with a yes/no question.
 * Automatically appends a "[y/n]" or "[Y/n]" suffix based on the default value.
 * Accepts both "y" and "yes" as affirmative responses (case-insensitive).
 *
 * @param message - The confirmation message to display to the user
 * @param defaultValue - The value returned when the user presses Enter without typing (default: false)
 * @returns Promise<boolean> - true if user confirms (y/yes), false otherwise
 */
export function promptForConfirmation(
  message: string,
  defaultValue: boolean = false,
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
    rl.question(promptMessage, (answer) => {
      rl.close();
      const response = answer.toLowerCase().trim();
      // Empty input → use default value
      if (response === "") {
        resolve(defaultValue);
        return;
      }
      resolve(response === "y" || response === "yes");
    });
  });
}
