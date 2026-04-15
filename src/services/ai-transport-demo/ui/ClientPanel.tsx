/**
 * Client panel — shows the conversation (user messages + assistant responses).
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Whether this message is still being streamed. */
  streaming?: boolean;
  /** Whether this message was interrupted (barge-in). */
  interrupted?: boolean;
}

interface ClientPanelProps {
  feature: string;
  channelName: string;
  messages: ConversationMessage[];
  serverStatus: "connecting" | "connected" | "not-found";
  maxVisible?: number;
}

export function ClientPanel({
  feature,
  channelName,
  messages,
  serverStatus,
  maxVisible = 20,
}: ClientPanelProps) {
  const visible = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box flexDirection="column">
        <Text bold>
          💬 AI Transport Demo:{" "}
          <Text color={colors.primary}>{formatFeatureName(feature)}</Text>
        </Text>
        <Text color={colors.dim}>Channel: {channelName}</Text>
      </Box>

      {/* Server status */}
      {serverStatus === "not-found" && (
        <Box marginTop={1}>
          <Text color={colors.warning}>
            ⚠ No server detected. Start a server or use --endpoint.
          </Text>
        </Box>
      )}
      {serverStatus === "connecting" && (
        <Box marginTop={1}>
          <Text color={colors.dim}>Connecting to server...</Text>
        </Box>
      )}

      {/* Conversation */}
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {visible.length === 0 && serverStatus === "connected" && (
          <Text color={colors.dim}>
            Type a message below to start the demo.
          </Text>
        )}
        {visible.map((msg) => (
          <Box key={msg.id} flexDirection="column" marginBottom={1}>
            {msg.role === "user" ? (
              <Text>
                <Text color={colors.user} bold>
                  You:{" "}
                </Text>
                <Text>{msg.content}</Text>
              </Text>
            ) : (
              <Box flexDirection="column">
                <Text>
                  <Text color={colors.primary} bold>
                    Agent:{" "}
                  </Text>
                  <Text color={colors.assistant}>
                    {msg.content}
                    {msg.streaming && <Text color={colors.dim}>▊</Text>}
                    {msg.interrupted && (
                      <Text color={colors.warning}> [interrupted]</Text>
                    )}
                  </Text>
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
