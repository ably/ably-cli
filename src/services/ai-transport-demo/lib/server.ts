/**
 * Local HTTP server for AI Transport demos.
 *
 * Spins up a server on localhost with an auto-assigned port.
 * Enters Ably presence on the demo channel to announce the endpoint.
 * Handles POST requests with user messages.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { EventEmitter } from "node:events";
import getPort from "get-port";
import type * as Ably from "ably";
import { symbols } from "../ui/theme.js";

export interface DemoServerOptions {
  /** The Ably channel to enter presence on. */
  channel: Ably.RealtimeChannel;
  /** Callback when an AIT SDK POST request is received. */
  onRequest: (body: AitRequestBody) => void;
}

/**
 * The request body format sent by the AIT client transport's send().
 * Contains turnId, clientId, messages (MessageWithHeaders[]), history, etc.
 */
export interface AitRequestBody {
  turnId: string;
  clientId?: string;
  messages: Array<{
    message: { id: string; role: string; content: string };
    headers?: Record<string, string>;
  }>;
  history?: unknown[];
  parent?: string | null;
  forkOf?: string;
}

export interface DemoServer {
  /** The port the server is listening on. */
  port: number;
  /** The full URL of the server endpoint. */
  url: string;
  /** Event emitter for server log events. */
  events: DemoServerEvents;
  /** Shut down the server and leave presence. */
  close: () => Promise<void>;
}

export class DemoServerEvents extends EventEmitter {
  emitLog(message: string): void {
    this.emit("log", message);
  }
}

/**
 * Create and start the demo HTTP server.
 * Enters presence on the Ably channel with the endpoint URL.
 */
export async function createDemoServer(
  options: DemoServerOptions,
): Promise<DemoServer> {
  const { channel, onRequest } = options;
  const events = new DemoServerEvents();

  // Find an available port
  const port = await getPort();
  const url = `http://localhost:${port}`;

  // Create HTTP server
  const server = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      // CORS headers for flexibility
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "POST" && (req.url === "/" || req.url === "/api/chat")) {
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body) as AitRequestBody;
            const firstMsg = parsed.messages?.[0]?.message;
            const preview = firstMsg?.content
              ? truncate(firstMsg.content, 50)
              : "(no content)";
            events.emitLog(`${symbols.incoming} Received: "${preview}"`);
            onRequest(parsed);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            events.emitLog("Invalid request body");
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    },
  );

  // Start listening
  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      events.emitLog(`Listening on ${url}`);
      resolve();
    });
  });

  // Enter presence on the Ably channel
  try {
    await channel.presence.enter({ endpoint: url });
    events.emitLog("Entered presence on channel");
  } catch (error: unknown) {
    events.emitLog(`Failed to enter presence: ${String(error)}`);
    // Continue anyway — presence is for discovery, not critical
  }

  return {
    port,
    url,
    events,
    close: () => closeServer(server, channel, events),
  };
}

async function closeServer(
  server: Server,
  channel: Ably.RealtimeChannel,
  events: DemoServerEvents,
): Promise<void> {
  // Leave presence
  try {
    await Promise.race([
      channel.presence.leave(),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    events.emitLog("Left presence");
  } catch {
    // Ignore cleanup errors
  }

  // Close HTTP server
  await new Promise<void>((resolve) => {
    server.close(() => {
      events.emitLog("Server stopped");
      resolve();
    });
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
