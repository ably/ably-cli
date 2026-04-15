/**
 * Collapsible debug console showing transport-level events.
 */

import React from "react";
import { Box, Text } from "ink";
import type { LogEntry } from "./hooks/use-scrollable-log.js";
import { colors } from "./theme.js";

interface DebugPanelProps {
  entries: LogEntry[];
  expanded: boolean;
  maxVisible?: number;
}

export function DebugPanel({
  entries,
  expanded,
  maxVisible = 6,
}: DebugPanelProps) {
  if (!expanded) {
    return (
      <Box>
        <Text color={colors.dim}>
          🔍 Debug ({entries.length} events) — Tab to expand
        </Text>
      </Box>
    );
  }

  const visible = entries.slice(-maxVisible);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.dim}
      paddingX={1}
    >
      <Text bold color={colors.dim}>
        🔍 Debug — Tab to collapse
      </Text>
      {visible.length === 0 && <Text color={colors.dim}>No events yet.</Text>}
      {visible.map((entry, i) => (
        <Text key={i} wrap="truncate" color={colors.dim}>
          {entry.timestamp} {entry.message}
        </Text>
      ))}
    </Box>
  );
}
