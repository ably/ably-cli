/**
 * React hook that connects the DemoOrchestrator to UI state.
 * Manages conversation messages, streaming status, and server/client state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ConversationMessage } from "../ClientPanel.js";
import type { DemoOrchestrator } from "../../lib/orchestrator.js";
import type { DemoMessage } from "../../lib/codec.js";

type ServerStatus = "connecting" | "connected" | "not-found";

interface UseDemoResult {
  messages: ConversationMessage[];
  isStreaming: boolean;
  serverPort: number | null;
  serverRunning: boolean;
  clientConnected: boolean;
  serverStatus: ServerStatus;
  sendMessage: (text: string) => void;
  cancelStream: () => void;
}

export function useDemo(orchestrator: DemoOrchestrator | null): UseDemoResult {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [clientConnected, setClientConnected] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("connecting");

  const orchestratorRef = useRef(orchestrator);
  orchestratorRef.current = orchestrator;

  useEffect(() => {
    if (!orchestrator) return;

    const onServerReady = (data: { port: number }) => {
      setServerPort(data.port);
      setServerRunning(true);
    };

    const onClientConnected = () => {
      setClientConnected(true);
      setServerStatus("connected");
    };

    const onServerNotFound = () => {
      setServerStatus("not-found");
    };

    // The orchestrator emits the full message list from the AIT client
    // transport. Streaming updates include a `streaming` flag on the
    // in-progress assistant message (cursor indicator); barge-in marks
    // the interrupted message with `interrupted` so the UI can show a
    // visual cue that the response was cut short.
    const onMessages = (
      msgs: Array<DemoMessage & { streaming?: boolean; interrupted?: boolean }>,
    ) => {
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          streaming: m.streaming,
          interrupted: m.interrupted,
        })),
      );
    };

    const onTurnEnd = () => {
      setIsStreaming(false);
    };

    const onError = () => {
      setIsStreaming(false);
    };

    orchestrator.on("serverReady", onServerReady);
    orchestrator.on("clientConnected", onClientConnected);
    orchestrator.on("serverNotFound", onServerNotFound);
    orchestrator.on("messages", onMessages);
    orchestrator.on("turnEnd", onTurnEnd);
    orchestrator.on("error", onError);

    return () => {
      orchestrator.off("serverReady", onServerReady);
      orchestrator.off("clientConnected", onClientConnected);
      orchestrator.off("serverNotFound", onServerNotFound);
      orchestrator.off("messages", onMessages);
      orchestrator.off("turnEnd", onTurnEnd);
      orchestrator.off("error", onError);
    };
  }, [orchestrator]);

  const sendMessage = useCallback((text: string) => {
    if (!orchestratorRef.current) return;
    setIsStreaming(true);
    orchestratorRef.current.sendMessage(text);
  }, []);

  const cancelStream = useCallback(() => {
    orchestratorRef.current?.cancelActiveTurn();
  }, []);

  return {
    messages,
    isStreaming,
    serverPort,
    serverRunning,
    clientConnected,
    serverStatus,
    sendMessage,
    cancelStream,
  };
}
