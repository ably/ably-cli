import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { setTimeout } from "node:timers/promises";

export class PromptHelper {
  /**
   * Prompts the user for confirmation with a timeout.
   */
  async getConfirmation(suggestion: string): Promise<boolean> {
    const promptAc = new AbortController();
    const timerAc = new AbortController();

    const confirmation = confirm(
      {
        default: true,
        message: `Did you mean ${chalk.blueBright(suggestion)}?`,
        theme: {
          prefix: "",
          style: {
            message: (text: string) => chalk.reset(text),
          },
        },
      },
      { signal: promptAc.signal },
    );

    // Timeout the prompt after 10 seconds
    void setTimeout(10_000, "timeout", { signal: timerAc.signal })
      .catch(() => {}) // Ignore timer cancellation
      .then(() => promptAc.abort());

    try {
      const value = await confirmation;
      return value;
    } catch {
      // Handle cancellation (e.g., Ctrl+C or timeout) as 'No'
      return false;
    } finally {
      timerAc.abort(); // Cancel the pending timer
      promptAc.abort(); // Clean up the prompt controller
    }
  }
}

// Utility function to format a prompt message with chalk
export function formatPromptMessage(
  message: string,
  suggestion?: string,
): string {
  if (suggestion) {
    // Use chalk for styling
    return `${message} ${chalk.blueBright(suggestion)}?`;
  }
  return message;
}

// Note: The actual prompt logic (using inquirer) is now handled directly
// within the did-you-mean.ts hook for better context management.
// This file now only contains utility functions if needed,
// or can be removed if formatPromptMessage is moved/inlined.

export function formatSuggestion(suggestion: string): string {
  return chalk.blueBright(suggestion);
}
