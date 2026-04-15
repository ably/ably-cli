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

import { DemoCodec, type DemoMessage } from "./codec.js";
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
  on(event: "debugLog", listener: (message: string) => void): this;
  on(event: "messages", listener: (msgs: DemoMessage[]) => void): this;
  on(event: "serverReady", listener: (data: { port: number }) => void): this;
  on(event: "clientConnected", listener: () => void): this;
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

    emitter.emit("serverLog", `→ turn:start ${turnId.slice(0, 8)}…`);

    let turn: ReturnType<typeof serverTransport.newTurn> | null = null;

    try {
      turn = serverTransport.newTurn({
        turnId,
        clientId: body.clientId ?? clientId,
      });

      await turn.start();

      // Note: we do NOT call turn.addMessages() here because the client
      // transport already published the user message to the channel when
      // it called send(). Re-publishing would cause a duplicate.

      // Stream fake LLM response through the encoder
      const llmStream = createFakeLLMStream({
        feature,
        userMessage,
        signal: abortController.signal,
      });

      emitter.emit("serverLog", "→ streaming response...");

      const result = await turn.streamResponse(llmStream);

      try {
        await turn.end(result.reason);
      } catch {
        // Connection may already be closing
      }

      emitter.emit(
        "serverLog",
        `← turn:end ${turnId.slice(0, 8)}… (${result.reason})`,
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
        `✗ turn ${turnId.slice(0, 8)}… failed: ${errorMsg}`,
      );
      emitter.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      streaming = false;
      activeTurnAbort = null;
    }
  }

  // ── Client side ──

  emitter.startClient = async () => {
    emitter.emit("debugLog", "Starting client...");

    // Discover server if no explicit endpoint
    if (!serverEndpoint) {
      emitter.emit("debugLog", "Discovering server via presence...");
      const discovered = await discoverServer(channel, 10_000, (msg) => {
        emitter.emit("debugLog", msg);
      });

      if (!discovered) {
        emitter.emit("debugLog", "No server found");
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
      const msgs = clientTransport!.getMessages();
      emitter.emit("messages", msgs);
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

    emitter.emit("debugLog", `Sending: "${text.slice(0, 40)}..."`);

    try {
      const userMsg: DemoMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      const activeTurn = await clientTransport.send(userMsg);

      // Consume the stream to drive the transport (messages arrive via 'message' event)
      const reader = activeTurn.stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (error: unknown) {
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
