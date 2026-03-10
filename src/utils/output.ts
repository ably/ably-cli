import chalk, { type ChalkInstance } from "chalk";
import type * as Ably from "ably";
import { formatMessageData, isJsonData } from "./json-formatter.js";

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

/**
 * Fields for consistent message display across subscribe and history commands.
 * All fields use the same names and format for both human-readable and JSON output.
 * Timestamp is raw milliseconds (Unix epoch) — not converted to ISO string.
 */
export interface MessageDisplayFields {
  channel: string;
  clientId?: string;
  data: unknown;
  event: string;
  id?: string;
  indexPrefix?: string;
  sequencePrefix?: string;
  serial?: string;
  timestamp: number;
  version?: Ably.MessageVersion;
  annotations?: Ably.MessageAnnotations;
}

/**
 * Format an array of messages for human-readable console output.
 * Each message shows all fields on separate lines, messages separated by blank lines.
 * Returns "No messages found." for empty arrays.
 */
export function formatMessagesOutput(messages: MessageDisplayFields[]): string {
  if (messages.length === 0) {
    return "No messages found.";
  }

  const formatted = messages.map((msg) => {
    const lines: string[] = [];

    if (msg.indexPrefix) {
      lines.push(chalk.dim(msg.indexPrefix));
    }

    const timestampLine = `${chalk.dim("Timestamp:")} ${msg.timestamp}`;
    lines.push(
      msg.sequencePrefix
        ? `${msg.sequencePrefix}${timestampLine}`
        : timestampLine,
      `${chalk.dim("Channel:")} ${resource(msg.channel)}`,
      `${chalk.dim("Event:")} ${chalk.yellow(msg.event)}`,
    );

    if (msg.id) {
      lines.push(`${chalk.dim("ID:")} ${msg.id}`);
    }

    if (msg.clientId) {
      lines.push(`${chalk.dim("Client ID:")} ${chalk.blue(msg.clientId)}`);
    }

    if (msg.serial) {
      lines.push(`${chalk.dim("Serial:")} ${msg.serial}`);
    }

    if (
      msg.version &&
      Object.keys(msg.version).length > 0 &&
      msg.version.serial &&
      msg.version.serial !== msg.serial
    ) {
      lines.push(`${chalk.dim("Version:")}`);
      if (msg.version.serial) {
        lines.push(`  ${chalk.dim("Serial:")} ${msg.version.serial}`);
      }
      if (msg.version.timestamp !== undefined) {
        lines.push(`  ${chalk.dim("Timestamp:")} ${msg.version.timestamp}`);
      }
      if (msg.version.clientId) {
        lines.push(
          `  ${chalk.dim("Client ID:")} ${chalk.blue(msg.version.clientId)}`,
        );
      }
    }

    if (msg.annotations && Object.keys(msg.annotations.summary).length > 0) {
      lines.push(`${chalk.dim("Annotations:")}`);
      for (const [type, entry] of Object.entries(msg.annotations.summary)) {
        const formatted = formatMessageData(entry);
        const indented = formatted
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n");
        lines.push(`  ${chalk.dim(`${type}:`)}`, indented);
      }
    }

    if (isJsonData(msg.data)) {
      lines.push(`${chalk.dim("Data:")}\n${formatMessageData(msg.data)}`);
    } else {
      lines.push(`${chalk.dim("Data:")} ${String(msg.data)}`);
    }

    return lines.join("\n");
  });

  return formatted.join("\n\n");
}

/**
 * Convert a single MessageDisplayFields to a plain object for JSON output.
 * Includes all required fields, omits undefined optional fields.
 *
 * Usage:
 *   Single message (subscribe):  toMessageJson(msg)
 *   Array of messages (history): messages.map(toMessageJson)
 */
export function toMessageJson(
  msg: MessageDisplayFields,
): Record<string, unknown> {
  return {
    timestamp: msg.timestamp,
    channel: msg.channel,
    event: msg.event,
    ...(msg.id ? { id: msg.id } : {}),
    ...(msg.clientId ? { clientId: msg.clientId } : {}),
    ...(msg.serial ? { serial: msg.serial } : {}),
    ...(msg.version ? { version: msg.version } : {}),
    ...(msg.annotations ? { annotations: msg.annotations } : {}),
    data: msg.data,
  };
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
