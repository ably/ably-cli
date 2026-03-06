/**
 * Parse a flexible timestamp string into milliseconds since epoch.
 *
 * Accepts:
 * - Unix milliseconds as a numeric string (e.g., "1700000000000")
 * - Relative time shorthand (e.g., "30s", "5m", "1h", "2d", "1w")
 * - ISO 8601 date or datetime string (e.g., "2023-01-01", "2023-01-01T00:00:00Z")
 */
export function parseTimestamp(input: string, label = "timestamp"): number {
  const trimmed = input.trim();

  // Pure numeric → ms since epoch
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);

  // Relative time: 30s, 5m, 1h, 2d, 1w
  const match = /^(\d+)([smhdw])$/.exec(trimmed);
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

  // Strict ISO 8601 validation: date-only (interpreted as UTC) or date-time with required timezone
  const isIso =
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(
      trimmed,
    );
  if (!isIso) {
    throw new TypeError(
      `Invalid ${label}: "${input}". ` +
        `Use ISO 8601 (e.g., "2023-01-01T00:00:00Z"), Unix ms (e.g., "1700000000000"), or relative (e.g., "1h", "30m", "2d").`,
    );
  }

  const ms = new Date(trimmed).getTime();
  if (Number.isNaN(ms)) {
    throw new TypeError(
      `Invalid ${label}: "${input}". ` +
        `Use ISO 8601 (e.g., "2023-01-01T00:00:00Z"), Unix ms (e.g., "1700000000000"), or relative (e.g., "1h", "30m", "2d").`,
    );
  }

  return ms;
}
