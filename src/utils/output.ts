import chalk from "chalk";

import { formatJson, isJsonData } from "./json-formatter.js";

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
 * Fields used to display a single message in both subscribe and history commands.
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
  timestamp: string;
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

  const blocks: string[] = [];

  for (const msg of messages) {
    const lines: string[] = [];

    if (msg.indexPrefix) {
      lines.push(chalk.dim(msg.indexPrefix));
    }

    const timestampLine = `${chalk.dim("Timestamp:")} ${msg.timestamp}`;
    lines.push(
      msg.sequencePrefix
        ? `${chalk.dim(msg.sequencePrefix)} ${timestampLine}`
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

    if (isJsonData(msg.data)) {
      lines.push(chalk.dim("Data:"), formatJson(msg.data));
    } else {
      lines.push(`${chalk.dim("Data:")} ${msg.data}`);
    }

    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
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
    data: msg.data,
  };
}
