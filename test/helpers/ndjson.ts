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
