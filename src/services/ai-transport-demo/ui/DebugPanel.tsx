/**
 * Debug console showing transport-level events.
 * Always shows at least a few lines; Tab toggles between compact and expanded.
 */

import React from "react";
import { Box, Text } from "ink";
import type { LogEntry } from "./hooks/use-scrollable-log.js";
import { colors } from "./theme.js";

interface DebugPanelProps {
  entries: LogEntry[];
  expanded: boolean;
  /** Number of lines to show (2 compact, 8 expanded) */
  visibleLines?: number;
}

export function DebugPanel({
  entries,
  expanded,
  visibleLines = 2,
}: DebugPanelProps) {
  const visible = entries.slice(-visibleLines);
  const hiddenCount = Math.max(0, entries.length - visibleLines);

  return (
    <Box flexDirection="column">
      <Text color={colors.dim}>
        🔍 Debug{" "}
        {hiddenCount > 0 && !expanded && (
          <Text color={colors.dim}>({hiddenCount} more) </Text>
        )}
        <Text color={colors.dim}>— Tab {expanded ? "less" : "more"}</Text>
      </Text>
      {visible.length === 0 && (
        <Text color={colors.dim}> Waiting for events...</Text>
      )}
      {visible.map((entry, i) => (
        <Text key={i} wrap="truncate" color={colors.dim}>
          {"  "}
          {entry.timestamp} {entry.message}
        </Text>
      ))}
    </Box>
  );
}
