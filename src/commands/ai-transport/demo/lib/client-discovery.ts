/**
 * Presence-based server discovery for AI Transport demos.
 *
 * The demo server enters presence on the Ably channel with its HTTP
 * endpoint in the presence data. The client subscribes to presence
 * and discovers the server automatically.
 */

import type * as Ably from "ably";

export interface DiscoveredServer {
  /** The server's HTTP endpoint URL. */
  endpoint: string;
  /** The client ID of the server presence member. */
  clientId?: string;
}

/**
 * Discover the demo server by subscribing to presence on the channel.
 *
 * Returns the server's endpoint URL, or null if no server is found
 * within the timeout period.
 *
 * @param channel - The Ably channel to watch for server presence
 * @param timeoutMs - How long to wait for a server (default 10s)
 * @param onLog - Optional callback for discovery log messages
 */
export async function discoverServer(
  channel: Ably.RealtimeChannel,
  timeoutMs = 10_000,
  onLog?: (message: string) => void,
): Promise<DiscoveredServer | null> {
  onLog?.("Searching for server via presence...");

  // First, check if the server is already present
  try {
    const members = await channel.presence.get();
    for (const member of members) {
      const server = extractServerFromPresence(member);
      if (server) {
        onLog?.(`Found server at ${server.endpoint}`);
        return server;
      }
    }
  } catch {
    // Channel might not be attached yet, fall through to subscribe
  }

  // Subscribe to presence and wait for a server to appear
  return new Promise<DiscoveredServer | null>((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        channel.presence.unsubscribe(onPresenceEvent);
      }
    };

    const onPresenceEvent = (message: Ably.PresenceMessage) => {
      if (message.action === "enter" || message.action === "present") {
        const server = extractServerFromPresence(message);
        if (server) {
          onLog?.(`Found server at ${server.endpoint}`);
          cleanup();
          resolve(server);
        }
      }
    };

    channel.presence.subscribe(onPresenceEvent);

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        onLog?.("No server found within timeout");
        cleanup();
        resolve(null);
      }
    }, timeoutMs);
  });
}

/**
 * Extract server info from a presence message.
 * The server enters presence with { endpoint: "http://localhost:PORT" }.
 */
function extractServerFromPresence(
  member: Ably.PresenceMessage,
): DiscoveredServer | null {
  const data = member.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "endpoint" in data &&
    typeof (data as { endpoint: unknown }).endpoint === "string"
  ) {
    return {
      endpoint: (data as { endpoint: string }).endpoint,
      clientId: member.clientId,
    };
  }

  return null;
}
