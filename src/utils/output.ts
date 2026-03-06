import chalk, { type ChalkInstance } from "chalk";

export function progress(message: string): string {
  return `${message}...`;
}

export function success(message: string): string {
  return `${chalk.green("✓")} ${message}`;
}

export function listening(description: string): string {
  return chalk.dim(`${description} Press Ctrl+C to exit.`);
}

export function resource(name: string): string {
  return chalk.cyan(name);
}

export function formatTimestamp(ts: string): string {
  return chalk.dim(`[${ts}]`);
}

/**
 * Format a message timestamp (from Ably message.timestamp) to ISO string.
 * Falls back to current time if timestamp is not provided.
 */
export function formatMessageTimestamp(
  timestamp: number | Date | undefined | null,
): string {
  if (!timestamp && timestamp !== 0) return new Date().toISOString();
  return timestamp instanceof Date
    ? timestamp.toISOString()
    : new Date(timestamp).toISOString();
}

export function formatPresenceAction(action: string): {
  symbol: string;
  color: ChalkInstance;
} {
  switch (action.toLowerCase()) {
    case "enter": {
      return { symbol: "✓", color: chalk.green };
    }
    case "leave": {
      return { symbol: "✗", color: chalk.red };
    }
    case "update": {
      return { symbol: "⟲", color: chalk.yellow };
    }
    default: {
      return { symbol: "•", color: chalk.white };
    }
  }
}
