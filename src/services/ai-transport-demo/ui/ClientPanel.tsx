/**
 * Client panel — the conversation area showing user messages and agent responses.
 * Header, debug, and input are handled by App; this is just the message list.
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  interrupted?: boolean;
}

interface ClientPanelProps {
  messages: ConversationMessage[];
  serverStatus: "connecting" | "connected" | "not-found";
  isStreaming: boolean;
}

export function ClientPanel({
  messages,
  serverStatus,
  isStreaming,
}: ClientPanelProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {serverStatus === "not-found" && (
        <Text color={colors.warning}>
          ⚠ No server detected. Start a server or use --endpoint.
        </Text>
      )}
      {serverStatus === "connecting" && (
        <Text color={colors.dim}>Connecting to server...</Text>
      )}

      {messages.length === 0 &&
        serverStatus === "connected" &&
        !isStreaming && (
          <Text color={colors.dim}>
            Type a message below to start the demo.
          </Text>
        )}

      {messages.map((msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={1}>
          {msg.role === "user" ? (
            <Text>
              <Text color={colors.user} bold>
                You:{" "}
              </Text>
              <Text>{msg.content}</Text>
            </Text>
          ) : (
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
          )}
        </Box>
      ))}
    </Box>
  );
}
