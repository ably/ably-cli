/**
 * Demo orchestrator — wires the server transport, client transport,
 * HTTP server, fake LLM, and presence discovery together.
 *
 * Emits events that the UI consumes to update panels.
 */

import { EventEmitter } from "node:events";
import type * as Ably from "ably";
import { createServerTransport, createClientTransport } from "@ably/ai-transport";
import type {
  ServerTransport,
  ClientTransport,
  TurnLifecycleEvent,
} from "@ably/ai-transport";

import { DemoCodec, setDecoderDebug, type DemoMessage } from "./codec.js";
import { createFakeLLMStream, type FakeLLMEvent } from "./fake-llm.js";
import {
  createDemoServer,
  type DemoServer,
  type AitRequestBody,
} from "./server.js";
import { discoverServer } from "./client-discovery.js";

export interface OrchestratorOptions {
  /** The Ably channel for the demo. */
  channel: Ably.RealtimeChannel;
  /** Which demo feature is running. */
  feature: string;
  /** Optional endpoint to use instead of presence discovery. */
  endpoint?: string;
  /** Client ID for presence and messages. */
  clientId: string;
  /** Called when the Ably connection should be closed (e.g., fatal config error). */
  onFatalError?: () => void;
}

/** Error code for mutable messages not enabled. */
const MUTABLE_MESSAGES_ERROR_CODE = 93002;

export interface DemoOrchestrator extends EventEmitter {
  startServer(): Promise<void>;
  startClient(): Promise<void>;
  sendMessage(text: string): Promise<void>;
  cancelActiveTurn(): Promise<void>;
  isStreaming(): boolean;
  close(): Promise<void>;

  on(event: "serverLog", listener: (message: string) => void): this;
  on(event: "serverStatus", listener: (status: string | null) => void): this;
  on(event: "debugLog", listener: (message: string) => void): this;
  on(event: "messages", listener: (msgs: DemoMessage[]) => void): this;
  on(event: "serverReady", listener: (data: { port: number }) => void): this;
  on(event: "clientConnected", listener: () => void): this;
  on(event: "serverNotFound", listener: () => void): this;
  on(event: "turnEnd", listener: (data: { turnId: string; reason: string }) => void): this;
  on(event: "mutableMessagesRequired", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

export function createOrchestrator(options: OrchestratorOptions): DemoOrchestrator {
  const { channel, feature, endpoint: explicitEndpoint, clientId, onFatalError } = options;
  const emitter = new EventEmitter() as DemoOrchestrator;

  let demoServer: DemoServer | null = null;
  let serverTransport: ServerTransport<FakeLLMEvent, DemoMessage> | null = null;
  let clientTransport: ClientTransport<FakeLLMEvent, DemoMessage> | null = null;
  let serverEndpoint: string | null = explicitEndpoint ?? null;
  let activeTurnAbort: AbortController | null = null;
  let streaming = false;
  let activeClientTurnId: string | null = null;
  const interruptedMessageIds = new Set<string>();

  function emitMessages(): void {
    if (!clientTransport) return;
    const msgs = clientTransport.getMessages();
    // Mark the last assistant message as streaming when a turn is in flight
    // (for the cursor indicator). Mark any message in `interruptedMessageIds`
    // as interrupted so the UI shows a barge-in indicator.
    const withFlags: Array<
      DemoMessage & { streaming?: boolean; interrupted?: boolean }
    > = msgs.map((m, i) => {
      const interrupted = interruptedMessageIds.has(m.id);
      const streaming =
        !!activeClientTurnId &&
        i === msgs.length - 1 &&
        m.role === "assistant" &&
        !interrupted;
      return {
        ...m,
        ...(streaming ? { streaming: true } : {}),
        ...(interrupted ? { interrupted: true } : {}),
      };
    });
    emitter.emit("messages", withFlags);
  }

  // ── Server side ──

  emitter.startServer = async () => {
    emitter.emit("serverLog", "Starting server...");

    serverTransport = createServerTransport<FakeLLMEvent, DemoMessage>({
      channel,
      codec: DemoCodec,
    });

    demoServer = await createDemoServer({
      channel,
      onRequest: (body: AitRequestBody) => {
        handleServerRequest(body);
      },
    });

    demoServer.events.on("log", (msg: string) => {
      emitter.emit("serverLog", msg);
    });

    serverEndpoint = demoServer.url;
    emitter.emit("serverReady", { port: demoServer.port });
    emitter.emit("serverLog", `Ready on :${demoServer.port}`);
  };

  async function handleServerRequest(body: AitRequestBody) {
    if (!serverTransport) return;

    // Extract user message text from the AIT SDK's POST body
    const userMessage =
      body.messages?.[0]?.message?.content ?? "(empty message)";
    const turnId = body.turnId;

    const abortController = new AbortController();
    activeTurnAbort = abortController;
    streaming = true;

    const shortTurnId = turnId.slice(0, 8);
    emitter.emit("serverLog", `→ ${shortTurnId}… turn:start`);

    let turn: ReturnType<typeof serverTransport.newTurn> | null = null;

    try {
      turn = serverTransport.newTurn({
        turnId,
        clientId: body.clientId ?? clientId,
      });

      await turn.start();

      // Publish the user message(s) back to the channel via addMessages().
      // The client transport's send() only inserts them optimistically into
      // its local tree (with no serial) and sends them in the HTTP POST body
      // — it does NOT publish them on the channel. Without addMessages the
      // user message stays at null-serial, which sorts AFTER serial-bearing
      // assistant messages in ConversationTree.flatten(). The client
      // de-duplicates via its _ownMsgIds set using the x-ably-msg-id header.
      if (body.messages && body.messages.length > 0) {
        await turn.addMessages(
          body.messages.map((m) => ({
            message: m.message as DemoMessage,
            headers: m.headers ?? {},
          })),
        );
      }

      // Stream fake LLM response through the encoder, counting tokens so
      // we can surface periodic progress updates on the server log.
      let tokenCount = 0;
      const llmStream = createFakeLLMStream({
        feature,
        userMessage,
        signal: abortController.signal,
      });
      const progressStream = new TransformStream<FakeLLMEvent, FakeLLMEvent>({
        transform(event, controller) {
          if (event.type === "text-delta") {
            tokenCount++;
            // In-place status update — the UI renders this as a single
            // line that overwrites itself, rather than appending to the log.
            emitter.emit(
              "serverStatus",
              `${shortTurnId}… streaming: ${tokenCount} tokens`,
            );
          }
          controller.enqueue(event);
        },
      });

      emitter.emit("serverLog", `→ ${shortTurnId}… streaming response`);
      const result = await turn.streamResponse(
        llmStream.pipeThrough(progressStream),
      );

      try {
        await turn.end(result.reason);
      } catch {
        // Connection may already be closing
      }

      // Clear the in-place status and append the final log line
      emitter.emit("serverStatus", null);
      emitter.emit(
        "serverLog",
        `← ${shortTurnId}… turn:end ${tokenCount} tokens (${result.reason})`,
      );
      emitter.emit("turnEnd", { turnId, reason: result.reason });
    } catch (error: unknown) {
      if (isMutableMessagesError(error)) {
        emitter.emit("serverLog", "✗ Mutable messages not enabled");
        // Close transports and Ably connection immediately to stop the
        // SDK from retrying inflight operations that keep getting NACKed.
        // Do this before emitting the event so the UI shows cleanly.
        onFatalError?.();
        emitter.close().catch(() => {});
        emitter.emit("mutableMessagesRequired");
        return;
      }

      // For non-fatal errors, try to end the turn gracefully
      if (turn) {
        try {
          await turn.end("error");
        } catch {
          // Connection may already be closing
        }
      }

      const errorMsg =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : String(error);
      emitter.emit(
        "serverLog",
        `✗ ${shortTurnId}… failed: ${errorMsg}`,
      );
      emitter.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      streaming = false;
      activeTurnAbort = null;
      emitter.emit("serverStatus", null);
    }
  }

  // ── Client side ──

  emitter.startClient = async () => {
    emitter.emit("debugLog", "Starting client...");

    // Decoder debug is noisy — leave off for now
    setDecoderDebug(null);

    // Discover server if no explicit endpoint
    if (!serverEndpoint) {
      emitter.emit("debugLog", "Discovering server via presence...");
      const discovered = await discoverServer(channel, 10_000, (msg) => {
        emitter.emit("debugLog", msg);
      });

      if (!discovered) {
        emitter.emit("debugLog", "No server found within timeout");
        emitter.emit("serverNotFound");
        return;
      }

      serverEndpoint = discovered.endpoint;
    }

    emitter.emit("debugLog", `Server at ${serverEndpoint}`);

    // Create the AIT client transport
    clientTransport = createClientTransport<FakeLLMEvent, DemoMessage>({
      channel,
      codec: DemoCodec,
      clientId,
      api: serverEndpoint,
    });

    // Subscribe to message changes — emit the full message list on each update
    clientTransport.on("message", () => {
      emitMessages();
    });

    // Subscribe to turn lifecycle events
    clientTransport.on("turn", (event: TurnLifecycleEvent) => {
      emitter.emit("debugLog", `[turn] ${event.type} (${event.turnId})`);
    });

    // Subscribe to errors
    clientTransport.on("error", (error: Ably.ErrorInfo) => {
      emitter.emit("debugLog", `[transport] error: ${error.message}`);
    });

    emitter.emit("clientConnected");
    emitter.emit("debugLog", "Client connected");
  };

  emitter.sendMessage = async (text: string) => {
    if (!clientTransport) {
      emitter.emit("debugLog", "No client transport — cannot send");
      return;
    }

    // Barge-in: if a turn is already in flight, cancel it before starting
    // the new one. Capture the currently-streaming assistant message so
    // the UI can mark it as interrupted once the cancel lands.
    if (activeClientTurnId) {
      const interruptingTurnId = activeClientTurnId;
      const liveMsgs = clientTransport.getMessages();
      const lastMsg = liveMsgs.at(-1);
      if (lastMsg && lastMsg.role === "assistant") {
        interruptedMessageIds.add(lastMsg.id);
      }

      emitter.emit(
        "debugLog",
        `Barging in — cancelling ${interruptingTurnId.slice(0, 8)}…`,
      );
      try {
        await clientTransport.cancel({ own: true });
      } catch (cancelError: unknown) {
        emitter.emit(
          "debugLog",
          `Cancel failed (continuing anyway): ${String(cancelError)}`,
        );
      }

      activeClientTurnId = null;
      // Push the interrupted state to the UI immediately, before the new
      // turn starts streaming, so the user sees the transition cleanly.
      emitMessages();
    }

    emitter.emit("debugLog", `Sending: "${text.slice(0, 40)}..."`);

    try {
      const userMsg: DemoMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      const activeTurn = await clientTransport.send(userMsg);
      activeClientTurnId = activeTurn.turnId;

      // The AIT client transport accumulates progressively and fires a
      // `message` event on every decoded text-delta (see the on('message')
      // handler in startClient). We just need to drain the stream so the
      // transport's internal processing runs to completion.
      const reader = activeTurn.stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      activeClientTurnId = null;
      emitMessages();
      emitter.emit("turnEnd", {
        turnId: activeTurn.turnId,
        reason: "complete",
      });
    } catch (error: unknown) {
      activeClientTurnId = null;
      emitter.emit("debugLog", `Send failed: ${String(error)}`);
    }
  };

  emitter.cancelActiveTurn = async () => {
    if (activeTurnAbort) {
      activeTurnAbort.abort();
      emitter.emit("debugLog", "Cancel signal sent (server-side)");
    }

    if (clientTransport) {
      await clientTransport.cancel({ own: true });
      emitter.emit("debugLog", "Cancel signal sent (client-side)");
    }
  };

  emitter.isStreaming = () => streaming;

  emitter.close = async () => {
    if (activeTurnAbort) {
      activeTurnAbort.abort();
    }

    if (clientTransport) {
      try {
        await clientTransport.close();
      } catch {
        // ignore cleanup errors
      }

      clientTransport = null;
    }

    if (serverTransport) {
      try {
        serverTransport.close();
      } catch {
        // ignore cleanup errors
      }

      serverTransport = null;
    }

    if (demoServer) {
      await demoServer.close();
      demoServer = null;
    }
  };

  return emitter;
}

function isMutableMessagesError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === MUTABLE_MESSAGES_ERROR_CODE
  ) {
    return true;
  }

  // Check stringified error for the code
  const msg = String(error);
  return msg.includes("93002") || msg.includes("mutableMessages");
}
