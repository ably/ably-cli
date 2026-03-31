/**
 * NDJSON (Newline Delimited JSON) test helpers.
 *
 * Use these to parse and filter the compact single-line JSON output
 * produced by --json, or the NDJSON streams from streaming commands.
 */

import { vi } from "vitest";

/**
 * Parse stdout containing one JSON object per line into an array of records.
 * Non-JSON lines (e.g. Node.js warnings, deprecation notices) are silently skipped.
 */
export function parseNdjsonLines(stdout: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  for (const line of stdout.trim().split("\n")) {
    if (!line) continue;
    try {
      results.push(JSON.parse(line));
    } catch {
      // skip non-JSON lines (Node.js warnings, deprecation notices, etc.)
    }
  }
  return results;
}

/**
 * Parse an array of log lines (e.g. from captured `this.log()` calls)
 * into JSON records, silently skipping non-JSON lines.
 */
export function parseLogLines(lines: string[]): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch {
      // skip non-JSON lines (human-readable output, progress messages, etc.)
    }
  }
  return results;
}

/**
 * Split stdout containing one or more JSON objects (compact or pretty-printed)
 * into an array of parsed records. Handles:
 * - Compact NDJSON (one JSON object per line)
 * - Pretty-printed JSON (multi-line indented objects)
 * - Mixed (e.g. pretty result followed by pretty completed signal)
 */
export function parseAllJsonRecords(stdout: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const trimmed = stdout.trim();
  if (!trimmed) return records;

  // Use incremental JSON.parse: find each top-level object by trying to parse
  // from the current position, extending until we get a valid parse.
  let remaining = trimmed;
  while (remaining.length > 0) {
    remaining = remaining.trimStart();
    if (!remaining) break;

    // Try compact NDJSON first: if the first line is valid JSON, take it
    const newlineIdx = remaining.indexOf("\n");
    if (newlineIdx !== -1) {
      const firstLine = remaining.slice(0, newlineIdx);
      try {
        records.push(JSON.parse(firstLine));
        remaining = remaining.slice(newlineIdx + 1);
        continue;
      } catch {
        // Not a single-line JSON object — try multi-line parse
      }
    }

    // Try parsing from the start, extending character by character.
    // For pretty-printed JSON, the closing `}` is on its own line.
    let parsed = false;
    for (let i = 1; i <= remaining.length; i++) {
      try {
        const obj = JSON.parse(remaining.slice(0, i));
        records.push(obj);
        remaining = remaining.slice(i);
        parsed = true;
        break;
      } catch {
        // Not enough characters yet
      }
    }
    if (!parsed) break; // Unparseable — stop
  }
  return records;
}

/**
 * Parse NDJSON or pretty-JSON stdout and return the primary result or error record
 * (i.e. the record with `type: "result"` or `type: "error"`).
 * Handles both compact NDJSON and pretty-printed JSON with multiple objects.
 * Use this instead of `JSON.parse(stdout)` when stdout may contain
 * multiple JSON records (e.g. result + completed signal).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJsonOutput(stdout: string): any {
  const records = parseAllJsonRecords(stdout);
  const primary = records.find(
    (r) => r.type === "result" || r.type === "error",
  );
  if (primary) return primary;
  return records.find((r) => r.type !== "status") ?? records[0] ?? {};
}

/**
 * Capture all console.log output from an async function and parse as JSON records.
 * Spy is always restored via `finally`, even on error.
 */
export async function captureJsonLogs(
  fn: () => Promise<unknown>,
): Promise<Record<string, unknown>[]> {
  const capturedLogs: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
    capturedLogs.push(String(msg));
  });
  try {
    await fn();
  } finally {
    logSpy.mockRestore();
  }
  return parseLogLines(capturedLogs);
}
