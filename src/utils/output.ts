import type * as Ably from "ably";
import chalk, { type ChalkInstance } from "chalk";

import { formatMessageData, isJsonData } from "./json-formatter.js";

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

/** Device push state display — green for ACTIVE, yellow for FAILING, red for FAILED */
export function formatDeviceState(state: string): string {
  switch (state.toUpperCase()) {
    case "ACTIVE": {
      return chalk.green(state);
    }
    case "FAILING": {
      return chalk.yellow(state);
    }
    case "FAILED": {
      return chalk.red(state);
    }
    default: {
      return state;
    }
  }
}

export interface MessageDisplayFields {
  action?: string;
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

export function formatMessagesOutput(messages: MessageDisplayFields[]): string {
  if (messages.length === 0) {
    return "No messages found.";
  }

  const blocks: string[] = [];

  for (const msg of messages) {
    const lines: string[] = [];

    if (msg.indexPrefix) {
      const headerLine = msg.sequencePrefix
        ? `${msg.sequencePrefix}${msg.indexPrefix}`
        : msg.indexPrefix;
      lines.push(headerLine);
    } else {
      const headerTimestamp = formatTimestamp(
        new Date(msg.timestamp).toISOString(),
      );
      const headerLine = msg.sequencePrefix
        ? `${msg.sequencePrefix}${headerTimestamp}`
        : headerTimestamp;
      lines.push(headerLine);
    }

    if (msg.id) {
      lines.push(`${formatLabel("ID")} ${msg.id}`);
    }

    lines.push(
      `${formatLabel("Timestamp")} ${formatMessageTimestamp(msg.timestamp)}`,
      `${formatLabel("Channel")} ${formatResource(msg.channel)}`,
      `${formatLabel("Event")} ${formatEventType(msg.event)}`,
    );

    if (msg.action) {
      lines.push(`${formatLabel("Action")} ${formatEventType(msg.action)}`);
    }

    if (msg.clientId) {
      lines.push(`${formatLabel("Client ID")} ${formatClientId(msg.clientId)}`);
    }

    if (msg.serial) {
      lines.push(`${formatLabel("Serial")} ${msg.serial}`);
    }

    if (
      msg.version &&
      typeof msg.version === "object" &&
      "serial" in msg.version &&
      msg.version.serial &&
      msg.version.serial !== msg.serial
    ) {
      lines.push(
        `${formatLabel("Version")}`,
        `  ${formatLabel("Serial")} ${msg.version.serial}`,
      );
      if (msg.version.timestamp !== undefined) {
        lines.push(
          `  ${formatLabel("Timestamp")} ${formatMessageTimestamp(msg.version.timestamp)}`,
        );
      }
      if (msg.version.clientId) {
        lines.push(
          `  ${formatLabel("Client ID")} ${formatClientId(msg.version.clientId)}`,
        );
      }
    }

    if (
      msg.annotations &&
      msg.annotations.summary &&
      Object.keys(msg.annotations.summary).length > 0
    ) {
      lines.push(`${formatLabel("Annotations")}`);
      for (const [annotationType, value] of Object.entries(
        msg.annotations.summary,
      )) {
        const formattedValue = formatMessageData(value)
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n");

        lines.push(`  ${formatLabel(annotationType)}`, formattedValue);
      }
    }

    if (isJsonData(msg.data)) {
      lines.push(`${formatLabel("Data")}`, formatMessageData(msg.data));
    } else {
      lines.push(`${formatLabel("Data")} ${String(msg.data)}`);
    }

    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

export interface PresenceDisplayFields {
  id?: string;
  timestamp: number;
  action: string;
  channel: string;
  clientId?: string;
  connectionId?: string;
  data?: unknown;
}

export function formatPresenceOutput(
  messages: PresenceDisplayFields[],
): string {
  if (messages.length === 0) {
    return "No presence events found.";
  }

  const blocks: string[] = [];

  for (const msg of messages) {
    const lines: string[] = [];

    lines.push(formatTimestamp(new Date(msg.timestamp).toISOString()));

    if (msg.id) {
      lines.push(`${formatLabel("ID")} ${msg.id}`);
    }

    lines.push(
      `${formatLabel("Timestamp")} ${formatMessageTimestamp(msg.timestamp)}`,
      `${formatLabel("Action")} ${formatEventType(msg.action)}`,
      `${formatLabel("Channel")} ${formatResource(msg.channel)}`,
    );

    if (msg.clientId) {
      lines.push(`${formatLabel("Client ID")} ${formatClientId(msg.clientId)}`);
    }

    if (msg.connectionId) {
      lines.push(`${formatLabel("Connection ID")} ${msg.connectionId}`);
    }

    if (msg.data !== null && msg.data !== undefined) {
      if (isJsonData(msg.data)) {
        lines.push(`${formatLabel("Data")}`, formatMessageData(msg.data));
      } else {
        lines.push(`${formatLabel("Data")} ${String(msg.data)}`);
      }
    }

    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

export interface AnnotationDisplayFields {
  id?: string;
  timestamp: number;
  channel: string;
  type: string;
  action?: string;
  name?: string;
  clientId?: string;
  count?: number;
  serial?: string;
  data?: unknown;
  indexPrefix?: string;
}

export function formatAnnotationsOutput(
  annotations: AnnotationDisplayFields[],
): string {
  if (annotations.length === 0) {
    return "No annotations found.";
  }

  const blocks: string[] = [];

  for (const ann of annotations) {
    const lines: string[] = [];

    if (ann.indexPrefix) {
      lines.push(ann.indexPrefix);
    } else {
      lines.push(formatTimestamp(new Date(ann.timestamp).toISOString()));
    }

    if (ann.id) {
      lines.push(`${formatLabel("ID")} ${ann.id}`);
    }

    lines.push(
      `${formatLabel("Timestamp")} ${formatMessageTimestamp(ann.timestamp)}`,
      `${formatLabel("Channel")} ${formatResource(ann.channel)}`,
      `${formatLabel("Type")} ${formatEventType(ann.type || "(none)")}`,
    );

    if (ann.action) {
      lines.push(`${formatLabel("Action")} ${formatEventType(ann.action)}`);
    }

    if (ann.name) {
      lines.push(`${formatLabel("Name")} ${ann.name}`);
    }

    if (ann.clientId) {
      lines.push(`${formatLabel("Client ID")} ${formatClientId(ann.clientId)}`);
    }

    if (ann.count !== undefined) {
      lines.push(`${formatLabel("Count")} ${ann.count}`);
    }

    if (ann.serial) {
      lines.push(`${formatLabel("Serial")} ${ann.serial}`);
    }

    if (ann.data !== undefined) {
      if (isJsonData(ann.data)) {
        lines.push(`${formatLabel("Data")}`, formatMessageData(ann.data));
      } else {
        lines.push(`${formatLabel("Data")} ${String(ann.data)}`);
      }
    }

    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
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
