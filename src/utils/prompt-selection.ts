import * as readline from "node:readline";

/**
 * Prompts the user to select an item from a numbered list.
 * Displays choices as "[1] Choice one", "[2] Choice two", etc.
 * Re-prompts on invalid input (out-of-range, non-numeric).
 * Returns null if the user enters empty input or stdin closes.
 *
 * @param message - The prompt message displayed above the list
 * @param choices - Array of { name, value } pairs (same format as inquirer list choices)
 * @returns Promise<T | null> - The selected item's value, or null if cancelled
 */
export function promptForSelection<T>(
  message: string,
  choices: Array<{ name: string; value: T }>,
): Promise<T | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Display the list
  rl.write(`${message}\n`);
  for (let i = 0; i < choices.length; i++) {
    rl.write(`  [${i + 1}] ${choices[i]!.name}\n`);
  }

  return new Promise<T | null>((resolve) => {
    const ask = () => {
      rl.question("Enter selection: ", (answer) => {
        const trimmed = answer.trim();

        // Empty input → cancel
        if (trimmed === "") {
          rl.close();
          resolve(null);
          return;
        }

        const num = Number.parseInt(trimmed, 10);

        // Invalid number or out of range → re-prompt
        if (Number.isNaN(num) || num < 1 || num > choices.length) {
          rl.write(
            `Invalid selection. Enter a number between 1 and ${choices.length}.\n`,
          );
          ask();
          return;
        }

        rl.close();
        resolve(choices[num - 1]!.value);
      });
    };

    ask();
  });
}
