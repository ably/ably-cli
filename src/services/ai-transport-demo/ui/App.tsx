/**
 * Root Ink component for AI Transport demos.
 *
 * Two clear panels side by side:
 * - Client (left): conversation + debug events + input — all inside one border
 * - Server (right): activity log, with space for future controls at the bottom
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ClientPanel, type ConversationMessage } from "./ClientPanel.js";
import { ServerPanel } from "./ServerPanel.js";
import { DebugPanel } from "./DebugPanel.js";
import { InputBar } from "./InputBar.js";
import { useScrollableLog } from "./hooks/use-scrollable-log.js";
import { colors } from "./theme.js";

export interface AppProps {
  role: "both" | "client" | "server";
  feature: string;
  channelName: string;
  onSendMessage?: (text: string) => void;
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
  const [dims, setDims] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  const [debugExpanded, setDebugExpanded] = useState(false);
  const [isStreaming] = useState(false);
  const [messages] = useState<ConversationMessage[]>([]);

  const serverLog = useScrollableLog();
  const debugLog = useScrollableLog();

  useEffect(() => {
    const onResize = () => {
      setDims({
        width: stdout?.columns ?? 80,
        height: stdout?.rows ?? 24,
      });
    };

    stdout?.on("resize", onResize);
    return () => {
      stdout?.off("resize", onResize);
    };
  }, [stdout]);

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

  const clientWidth = showServer ? Math.floor(dims.width * 0.6) : dims.width;

  // Debug: 2 lines always visible, 8 when expanded
  const debugLines = debugExpanded ? 8 : 2;

  return (
    <Box flexDirection="row" height={dims.height} width={dims.width}>
      {/* ── Client panel ── */}
      {showClient && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.activeBorder}
          width={clientWidth}
        >
          {/* Header */}
          <Box paddingX={1}>
            <Text bold>
              💬 AI Transport Demo:{" "}
              <Text color={colors.primary}>{formatFeatureName(feature)}</Text>
            </Text>
          </Box>
          <Box paddingX={1}>
            <Text color={colors.dim}>Channel: {channelName}</Text>
          </Box>

          {/* Conversation area — fills available space */}
          <Box flexDirection="column" flexGrow={1} paddingX={1} marginTop={1}>
            <ClientPanel
              messages={messages}
              serverStatus="connected"
              isStreaming={isStreaming}
            />
          </Box>

          {/* Debug events — always visible, 2 lines default */}
          <Box
            flexDirection="column"
            paddingX={1}
            borderStyle="single"
            borderTop
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor={colors.border}
          >
            <DebugPanel
              entries={debugLog.entries}
              expanded={debugExpanded}
              visibleLines={debugLines}
            />
          </Box>

          {/* Input — part of the client panel */}
          <Box
            paddingX={1}
            borderStyle="single"
            borderTop
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor={colors.border}
          >
            <InputBar onSubmit={handleSendMessage} isStreaming={isStreaming} />
          </Box>
        </Box>
      )}

      {/* ── Server panel ── */}
      {showServer && (
        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle="round"
          borderColor={colors.border}
        >
          {/* Server log — fills the panel */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            <ServerPanel
              entries={serverLog.entries}
              isRunning={false}
              maxVisible={dims.height - 4}
            />
          </Box>

          {/* Future: server controls bar would go here */}
          {/* <Box paddingX={1} borderStyle="single" borderTop ...>
               Restart │ Disconnect │ Kill stream
             </Box> */}
        </Box>
      )}
    </Box>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
