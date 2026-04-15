/**
 * Root Ink component for AI Transport demos.
 *
 * Renders the split-pane TUI with client (left) and server (right) panels,
 * a debug console, and an input bar.
 */

import React, { useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ClientPanel, type ConversationMessage } from "./ClientPanel.js";
import { ServerPanel } from "./ServerPanel.js";
import { DebugPanel } from "./DebugPanel.js";
import { InputBar } from "./InputBar.js";
import { useScrollableLog } from "./hooks/use-scrollable-log.js";
import { colors } from "./theme.js";

export interface AppProps {
  /** Which role the demo is running as. */
  role: "both" | "client" | "server";
  /** The demo feature name. */
  feature: string;
  /** The Ably channel name. */
  channelName: string;
  /** Callback when user submits a message. */
  onSendMessage?: (text: string) => void;
  /** Callback when user requests cancel (Ctrl+C). */
  onCancel?: () => void;
}

export function App({
  role,
  feature,
  channelName,
  onSendMessage,
  onCancel,
}: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;

  const [debugExpanded, setDebugExpanded] = useState(false);
  const [isStreaming] = useState(false);

  // Placeholder conversation messages
  const [messages] = useState<ConversationMessage[]>([]);

  // Server log
  const serverLog = useScrollableLog();

  // Debug log
  const debugLog = useScrollableLog();

  // Keyboard handling
  useInput((input, key) => {
    if (input === "d" && key.ctrl) {
      exit();
      return;
    }

    if (input === "c" && key.ctrl && isStreaming) {
      onCancel?.();
      return;
    }

    if (key.tab) {
      setDebugExpanded((prev) => !prev);
    }
  });

  const handleSendMessage = (text: string) => {
    onSendMessage?.(text);
  };

  const showClient = role === "both" || role === "client";
  const showServer = role === "both" || role === "server";

  // Calculate panel heights
  const debugHeight = debugExpanded ? 8 : 1;
  const inputHeight = 2;
  const mainHeight = terminalHeight - debugHeight - inputHeight - 2;

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Main panels */}
      <Box flexDirection="row" height={mainHeight}>
        {showClient && (
          <Box
            flexDirection="column"
            flexGrow={showServer ? 2 : 1}
            borderStyle="single"
            borderColor={colors.activeBorder}
            paddingX={1}
            width={showServer ? Math.floor(terminalWidth * 0.6) : undefined}
          >
            <ClientPanel
              feature={feature}
              channelName={channelName}
              messages={messages}
              serverStatus="connected"
              maxVisible={mainHeight - 4}
            />
          </Box>
        )}

        {showServer && (
          <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle="single"
            borderColor={colors.border}
            paddingX={1}
          >
            <ServerPanel
              entries={serverLog.entries}
              isRunning={false}
              maxVisible={mainHeight - 3}
            />
          </Box>
        )}
      </Box>

      {/* Debug panel (client side only in both mode) */}
      {showClient && (
        <DebugPanel entries={debugLog.entries} expanded={debugExpanded} />
      )}

      {/* Input bar (only when client is shown) */}
      {showClient ? (
        <InputBar onSubmit={handleSendMessage} isStreaming={isStreaming} />
      ) : (
        <Box>
          <Text color={colors.dim}>
            Server mode — no input. Ctrl+D to quit.
          </Text>
        </Box>
      )}
    </Box>
  );
}
