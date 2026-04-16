/**
 * Root Ink component for AI Transport demos.
 *
 * Two clear panels side by side:
 * - Client (left): conversation + debug events + input — all inside one border
 * - Server (right): activity log, with space for future controls at the bottom
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ClientPanel } from "./ClientPanel.js";
import { ServerPanel } from "./ServerPanel.js";
import { DebugPanel } from "./DebugPanel.js";
import { InputBar } from "./InputBar.js";
import { useScrollableLog } from "./hooks/use-scrollable-log.js";
import { useDemo } from "./hooks/use-demo.js";
import { colors } from "./theme.js";
import type { DemoOrchestrator } from "../lib/orchestrator.js";

export interface AppProps {
  role: "both" | "client" | "server";
  feature: string;
  channelName: string;
  orchestrator: DemoOrchestrator | null;
}

export function App({ role, feature, channelName, orchestrator }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dims, setDims] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  const [debugExpanded, setDebugExpanded] = useState(false);
  const [mutableMessagesError, setMutableMessagesError] = useState(false);

  const {
    messages,
    isStreaming,
    serverPort,
    serverRunning,
    clientConnected,
    serverStatus,
    sendMessage,
    cancelStream,
  } = useDemo(orchestrator);

  const serverLog = useScrollableLog();
  const debugLog = useScrollableLog();

  // Wire orchestrator events to log panels, then start server/client.
  // Starting happens inside useEffect so event listeners are attached first
  // and no events are missed.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!orchestrator) return;

    const onServerLog = (msg: string) => serverLog.addEntry(msg);
    const onDebugLog = (msg: string) => debugLog.addEntry(msg);

    const onMutableRequired = () => setMutableMessagesError(true);

    orchestrator.on("serverLog", onServerLog);
    orchestrator.on("debugLog", onDebugLog);
    orchestrator.on("mutableMessagesRequired", onMutableRequired);

    return () => {
      orchestrator.off("serverLog", onServerLog);
      orchestrator.off("debugLog", onDebugLog);
      orchestrator.off("mutableMessagesRequired", onMutableRequired);
    };
  }, [orchestrator, serverLog.addEntry, debugLog.addEntry]);

  // Start server and client after listeners are attached
  useEffect(() => {
    if (!orchestrator || started) return;
    setStarted(true);

    const startup = async () => {
      const runServer = role === "both" || role === "server";
      const runClient = role === "both" || role === "client";

      if (runServer) {
        await orchestrator.startServer();
      }

      if (runClient) {
        await orchestrator.startClient();
      }
    };

    startup().catch((error: unknown) => {
      debugLog.addEntry(`Startup error: ${String(error)}`);
    });
  }, [orchestrator, role, started, debugLog]);

  // Track terminal resize
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

  // Keyboard handling
  useInput((input, key) => {
    if (input === "d" && key.ctrl) {
      exit();
      return;
    }

    if (input === "c" && key.ctrl && isStreaming) {
      cancelStream();
      return;
    }

    if (key.tab) {
      setDebugExpanded((prev) => !prev);
    }
  });

  const showClient = role === "both" || role === "client";
  const showServer = role === "both" || role === "server";

  const clientWidth = showServer ? Math.floor(dims.width * 0.6) : dims.width;
  const debugLines = debugExpanded ? 8 : 2;

  // Server status for client panel
  if (mutableMessagesError) {
    const namespace = channelName.split(":")[0] || "ai-demo";
    return <MutableMessagesError namespace={namespace} />;
  }

  return (
    <Box flexDirection="row" height={dims.height} width={dims.width}>
      {/* ── Client panel ── */}
      {showClient && (
        <Box
          flexDirection="column"
          borderStyle="single"
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
              serverStatus={serverStatus}
              isStreaming={isStreaming}
            />
          </Box>

          {/* Debug events — always visible */}
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
            <InputBar
              onSubmit={sendMessage}
              isStreaming={isStreaming}
              disabled={!clientConnected}
            />
          </Box>
        </Box>
      )}

      {/* ── Server panel ── */}
      {showServer && (
        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderColor={colors.border}
        >
          {/* Show channel info in server-only mode */}
          {!showClient && (
            <Box paddingX={1} flexDirection="column">
              <Text bold>{formatFeatureName(feature)} Demo — Server</Text>
              <Text color={colors.dim}>Channel: {channelName}</Text>
              <Text color={colors.dim}>
                Connect a client: ably ai-transport demo {feature} --role client
                --channel {channelName}
              </Text>
            </Box>
          )}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            <ServerPanel
              entries={serverLog.entries}
              port={serverPort ?? undefined}
              isRunning={serverRunning}
              maxVisible={dims.height - (showClient ? 4 : 8)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * Renders the mutable messages error and exits after the frame is painted.
 * useEffect fires after React commits the render, so exit() is called
 * once the message is visible on screen.
 */
function MutableMessagesError({ namespace }: { namespace: string }) {
  const { exit } = useApp();

  useEffect(() => {
    exit();
  }, [exit]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={colors.error}>
        Setup Required: Mutable Messages
      </Text>
      <Text>
        AI Transport requires <Text bold>mutable messages</Text> on the{" "}
        <Text color={colors.primary}>{namespace}</Text> namespace.
      </Text>
      <Text> </Text>
      <Text>To set this up, either:</Text>
      <Text>
        {"  "}1.{" "}
        <Text color={colors.primary}>
          ably apps rules create --name {namespace} --mutable-messages
        </Text>
      </Text>
      <Text>
        {"  "}2. Dashboard: App {">"} Settings {">"} Rules {">"} add {namespace}{" "}
        with Mutable messages
      </Text>
      <Text> </Text>
      <Text color={colors.dim}>
        Docs: https://ably.com/docs/channels/options/mutable-messages
      </Text>
    </Box>
  );
}

function formatFeatureName(feature: string): string {
  return feature
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
