/**
 * Format a key's capability object for human-readable display.
 * Returns an array of lines (may be 1 line for single capability, or multiple with bullets).
 *
 * @param capability - The capability object from the key
 * @param indent - Optional prefix for each line (e.g. "  " for list items)
 */
export function formatCapabilities(
  capability: Record<string, string[] | string> | undefined,
  indent = "",
): string[] {
  if (!capability) {
    return [`${indent}Capabilities: None`];
  }

  const capEntries = Object.entries(capability);

  if (capEntries.length === 0) {
    return [`${indent}Capabilities: None`];
  }

  if (capEntries.length === 1) {
    const [scope, privileges] = capEntries[0]!;
    return [
      `${indent}Capabilities: ${scope} → ${Array.isArray(privileges) ? privileges.join(", ") : privileges}`,
    ];
  }

  const lines = [`${indent}Capabilities:`];
  for (const [scope, privileges] of capEntries) {
    lines.push(
      `${indent}  • ${scope} → ${Array.isArray(privileges) ? privileges.join(", ") : privileges}`,
    );
  }
  return lines;
}

/**
 * Format a capability as a single inline string (for before/after comparisons).
 */
export function formatCapabilityInline(
  capability: Record<string, string[] | string> | undefined,
): string {
  if (!capability) return "None";

  const capEntries = Object.entries(capability);
  if (capEntries.length === 0) return "None";

  return capEntries
    .map(
      ([scope, privileges]) =>
        `${scope} → ${Array.isArray(privileges) ? privileges.join(", ") : privileges}`,
    )
    .join("\n    ");
}
