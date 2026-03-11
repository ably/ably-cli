import chalk, { type ChalkInstance } from "chalk";

export function formatProgress(message: string): string {
  return `${message}...`;
}

export function formatSuccess(message: string): string {
  return `${chalk.green("✓")} ${message}`;
}

export function formatWarning(message: string): string {
  return `${chalk.yellow("⚠")} ${message}`;
}

export function formatListening(description: string): string {
  return chalk.dim(`${description} Press Ctrl+C to exit.`);
}

export function formatResource(name: string): string {
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
export function formatCountLabel(
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
export function formatLimitWarning(
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
export function formatClientId(id: string): string {
  return chalk.blue(id);
}

/** Event type/action display — yellow for event type labels */
export function formatEventType(type: string): string {
  return chalk.yellow(type);
}

/** Field label display — dim text with colon for structured output fields */
export function formatLabel(text: string): string {
  return chalk.dim(`${text}:`);
}

/** Record heading — bold text for list item headings */
export function formatHeading(text: string): string {
  return chalk.bold(text);
}

/** Index number display — dim bracketed number for history/list ordering */
export function formatIndex(n: number): string {
  return chalk.dim(`[${n}]`);
}

export type JsonRecordType = "error" | "event" | "log" | "result";

/**
 * Build a typed JSON envelope record.
 * - "result" and "error" types include `success: boolean`
 * - "event" and "log" types include only `type` and `command`
 * - Data fields are spread into the record. For "result" types, data can
 *   override `success` (e.g. partial-success batch results). For "error"
 *   types, `success` is always `false` and cannot be overridden by data.
 */
export function buildJsonRecord(
  type: JsonRecordType,
  command: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  // Strip reserved envelope keys from data to prevent payload collisions.
  // Also strip `success` from error records — errors are always success: false.
  const reservedKeys = new Set(["type", "command"]);
  if (type === "error") {
    reservedKeys.add("success");
  }
  const safeData = Object.fromEntries(
    Object.entries(data).filter(([key]) => !reservedKeys.has(key)),
  );
  return {
    type,
    command,
    ...(type === "result" || type === "error"
      ? { success: type !== "error" }
      : {}),
    ...safeData,
  };
}

/**
 * Format a JSON record as a string. Compact single-line for `json` mode
 * (NDJSON-friendly), pretty-printed for `prettyJson` mode.
 */
export function formatJsonString(
  data: Record<string, unknown>,
  options: { json?: boolean; prettyJson?: boolean },
): string {
  if (options.prettyJson) {
    return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(data);
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
