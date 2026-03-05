/**
 * Parse a flexible timestamp string into milliseconds since epoch.
 *
 * Accepts:
 * - Unix milliseconds as a numeric string (e.g., "1700000000000")
 * - Relative time shorthand (e.g., "30s", "5m", "1h", "2d", "1w")
 * - ISO 8601 or any Date-parseable string (e.g., "2023-01-01T00:00:00Z")
 */
export function parseTimestamp(input: string, label = "timestamp"): number {
  // Pure numeric → ms since epoch
  if (/^\d+$/.test(input)) return Number.parseInt(input, 10);

  // Relative time: 30s, 5m, 1h, 2d, 1w
  const match = /^(\d+)([smhdw])$/.exec(input);
  if (match) {
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
    };
    return Date.now() - Number.parseInt(match[1], 10) * multipliers[match[2]];
  }

  // ISO 8601 or other parseable date string
  const ms = new Date(input).getTime();
  if (Number.isNaN(ms)) {
    throw new TypeError(
      `Invalid ${label}: "${input}". ` +
        `Use ISO 8601 (e.g., "2023-01-01T00:00:00Z"), Unix ms (e.g., "1700000000000"), or relative (e.g., "1h", "30m", "2d").`,
    );
  }

  return ms;
}
