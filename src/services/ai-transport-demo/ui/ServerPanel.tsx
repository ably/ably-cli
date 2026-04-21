/**
 * Server panel — shows the server-side log of activity.
 * The server IS the log. No separate events section.
 */

import React from "react";
import { Box, Text } from "ink";
import type { LogEntry } from "./hooks/use-scrollable-log.js";
import { colors, symbols } from "./theme.js";

interface ServerPanelProps {
  entries: LogEntry[];
  status: string | null;
  port?: number;
  isRunning: boolean;
  maxVisible?: number;
}

export function ServerPanel({
  entries,
  status,
  port,
  isRunning,
  maxVisible = 20,
}: ServerPanelProps) {
  // Show the most recent entries
  const visible = entries.slice(-maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box>
        <Text bold>
          Server
          {port ? (
            <Text color={isRunning ? colors.success : colors.dim}>
              {" "}
              {isRunning ? `${symbols.listening} :${port}` : "(stopped)"}
            </Text>
          ) : (
            <Text color={colors.dim}> (starting...)</Text>
          )}
        </Text>
      </Box>

      {/* Log entries */}
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {visible.length === 0 && !status && (
          <Text color={colors.dim}>Waiting for activity...</Text>
        )}
        {visible.map((entry, i) => (
          <Text key={i} wrap="truncate">
            <Text color={colors.dim}>{entry.timestamp}</Text>{" "}
            <Text>{colorizeLogMessage(entry.message)}</Text>
          </Text>
        ))}
        {/* In-place status line — updates rather than appends */}
        {status && (
          <Text color={colors.event} wrap="truncate">
            → {status}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function colorizeLogMessage(message: string): React.ReactElement {
  // Colorize based on message content
  if (message.startsWith(symbols.incoming)) {
    return <Text color={colors.primary}>{message}</Text>;
  }

  if (message.startsWith(symbols.outgoing)) {
    return <Text color={colors.assistant}>{message}</Text>;
  }

  if (message.startsWith(symbols.feature)) {
    return <Text color={colors.event}>{message}</Text>;
  }

  if (message.includes("error") || message.includes("Error")) {
    return <Text color={colors.error}>{message}</Text>;
  }

  return <Text>{message}</Text>;
}
