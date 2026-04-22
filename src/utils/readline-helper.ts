import * as readline from "node:readline";

/**
 * Helper function to safely run prompt functions in interactive REPL mode
 * while preserving readline state and terminal settings.
 *
 * When the interactive REPL is active, creating a new readline interface
 * (e.g., via promptForConfirmation or promptForSelection) on the same stdin
 * can interfere with the REPL's paused readline — causing issues like arrow
 * keys showing escape sequences (^[[A) or lost line listeners.
 *
 * This wrapper:
 * 1. Pauses the REPL's readline and removes its line listeners
 * 2. Saves the terminal raw mode state
 * 3. Runs the prompt function
 * 4. Restores raw mode, line listeners, and resumes readline
 * 5. Calls _refreshLine() to ensure proper terminal state
 *
 * In non-interactive mode (interactiveReadline is null), the prompt runs directly.
 */
export async function runWithReadlineRestore<T>(
  promptFn: () => Promise<T>,
  interactiveReadline: readline.Interface | null,
): Promise<T> {
  if (!interactiveReadline) {
    // Not in interactive mode, just run the prompt normally
    return promptFn();
  }

  // Pause readline and save its state
  interactiveReadline.pause();
  const lineListeners = interactiveReadline.listeners("line");
  interactiveReadline.removeAllListeners("line");

  // Save terminal settings if available
  const stdin = process.stdin;
  const isRaw = stdin.isRaw;

  try {
    // Run the prompt function
    const result = await promptFn();

    return result;
  } finally {
    // Restore terminal settings
    if (stdin.isTTY) {
      stdin.setRawMode(isRaw);
    }

    // Restore line listeners
    lineListeners.forEach((listener) => {
      interactiveReadline.on("line", listener as (line: string) => void);
    });

    // Resume readline with a small delay to ensure terminal is ready
    setTimeout(() => {
      interactiveReadline.resume();

      // Force readline to redraw its prompt to ensure proper state
      if ("_refreshLine" in interactiveReadline) {
        const rlWithRefresh = interactiveReadline as readline.Interface & {
          _refreshLine?: () => void;
        };
        if (rlWithRefresh._refreshLine) {
          rlWithRefresh._refreshLine();
        }
      }
    }, 20);
  }
}
