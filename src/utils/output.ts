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

/**
 * Format a count with a singular/plural label.
 * E.g. countLabel(3, "message") → "3 messages" (with cyan count)
 */
export function countLabel(
  count: number,
  singular: string,
  plural?: string,
): string {
  const label = count === 1 ? singular : plural || singular + "s";
  return `${chalk.cyan(count.toString())} ${label}`;
}

/**
 * Show a limit warning when results may be truncated.
 * Returns null if count < limit.
 */
export function limitWarning(
  count: number,
  limit: number,
  resourceName: string,
): string | null {
  if (count >= limit) {
    return chalk.yellow(
      `Showing maximum of ${limit} ${resourceName}. Use --limit to show more.`,
    );
  }
  return null;
}

/** Client identity display — cyan-blue for client IDs in event output */
export function clientId(id: string): string {
  return chalk.blue(id);
}

/** Event type/action display — yellow for event type labels */
export function eventType(type: string): string {
  return chalk.yellow(type);
}

/** Field label display — dim text with colon for structured output fields */
export function label(text: string): string {
  return chalk.dim(`${text}:`);
}

/** Record heading — bold text for list item headings */
export function heading(text: string): string {
  return chalk.bold(text);
}

/** Index number display — dim bracketed number for history/list ordering */
export function index(n: number): string {
  return chalk.dim(`[${n}]`);
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
