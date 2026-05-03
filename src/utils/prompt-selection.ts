import * as readline from "node:readline";

import {
  getInteractiveReadline,
  runWithReadlineRestore,
} from "./readline-helper.js";

/**
 * A choice item is either selectable (has a value) or a separator (header line, not selectable).
 */
export type SelectionChoice<T> =
  | { name: string; value: T }
  | { separator: string };

function isSeparator<T>(
  choice: SelectionChoice<T>,
): choice is { separator: string } {
  return "separator" in choice;
}

/**
 * Prompts the user to select an item from a numbered list.
 * Displays choices as "[1] Choice one", "[2] Choice two", etc.
 * Separator entries render as un-numbered header lines and cannot be selected.
 * Re-prompts on invalid input (out-of-range, non-numeric).
 * Returns null if the user enters empty input, stdin closes, the choices list
 * has no selectable entries, or SIGINT is received.
 *
 * When invoked from the interactive REPL (`ABLY_INTERACTIVE_MODE=true`), this
 * function automatically pauses the REPL's readline, removes its line
 * listeners, runs the prompt, and restores everything afterwards — so callers
 * never need to wrap it in `runWithReadlineRestore` themselves.
 *
 * @param message - The prompt message displayed above the list
 * @param choices - Array of selectable items or separators
 * @returns Promise<T | null> - The selected item's value, or null if cancelled
 */
export function promptForSelection<T>(
  message: string,
  choices: Array<SelectionChoice<T>>,
): Promise<T | null> {
  const selectable = choices.filter(
    (c): c is { name: string; value: T } => !isSeparator(c),
  );

  if (selectable.length === 0) {
    return Promise.resolve(null);
  }

  return runWithReadlineRestore(
    () => promptForSelectionInternal(message, choices, selectable),
    getInteractiveReadline(),
  );
}

function promptForSelectionInternal<T>(
  message: string,
  choices: Array<SelectionChoice<T>>,
  selectable: Array<{ name: string; value: T }>,
): Promise<T | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Display the list. Selectable items get sequential numbers; separators render as plain
  // headers with a single leading space (matches inquirer's separator rendering in
  // @inquirer/select, which prints ` ${separator}` so headers visually outdent from items).
  rl.write(`${message}\n`);
  let index = 0;
  for (const choice of choices) {
    if (isSeparator(choice)) {
      rl.write(` ${choice.separator}\n`);
    } else {
      index += 1;
      rl.write(`  [${index}] ${choice.name}\n`);
    }
  }

  return new Promise<T | null>((resolve) => {
    let settled = false;

    const finish = (result: T | null) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(result);
    };

    rl.on("SIGINT", () => {
      finish(null);
    });

    rl.on("close", () => {
      finish(null);
    });

    const ask = () => {
      rl.question("Enter selection: ", (answer) => {
        const trimmed = answer.trim();

        // Empty input → cancel
        if (trimmed === "") {
          finish(null);
          return;
        }

        // Require the entire input to be a base-10 integer string
        if (!/^\d+$/.test(trimmed)) {
          rl.write(
            `Invalid selection. Enter a number between 1 and ${selectable.length}.\n`,
          );
          ask();
          return;
        }

        const num = Number.parseInt(trimmed, 10);

        // Out of range → re-prompt
        if (num < 1 || num > selectable.length) {
          rl.write(
            `Invalid selection. Enter a number between 1 and ${selectable.length}.\n`,
          );
          ask();
          return;
        }

        finish(selectable[num - 1]!.value);
      });
    };

    ask();
  });
}
