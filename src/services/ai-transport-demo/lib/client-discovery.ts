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

  // Check current presence members. Ably does not immediately remove
  // presence entries when a server crashes (unclean shutdown), so there
  // can be stale entries lingering on the channel. We probe each
  // candidate for liveness (HTTP OPTIONS) before accepting it, preferring
  // the most recent entry first.
  try {
    const members = await channel.presence.get();
    const candidates = members
      .map((m) => ({
        server: extractServerFromPresence(m),
        timestamp: m.timestamp ?? 0,
      }))
      .filter(
        (x): x is { server: DiscoveredServer; timestamp: number } =>
          x.server !== null,
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    if (candidates.length > 0) {
      onLog?.(
        `Probing ${candidates.length} presence entry(s) for liveness...`,
      );
      for (const candidate of candidates) {
        if (await isReachable(candidate.server.endpoint)) {
          onLog?.(`Found live server at ${candidate.server.endpoint}`);
          return candidate.server;
        }
        onLog?.(`Skipping unreachable entry: ${candidate.server.endpoint}`);
      }
    }
  } catch {
    // Channel might not be attached yet, fall through to subscribe
  }

  // No live server yet — subscribe to presence and wait for one to
  // enter. Probe each entry as it arrives so late-arriving stale
  // entries (e.g. history replay) don't take precedence over real
  // live servers.
  return new Promise<DiscoveredServer | null>((resolve) => {
    let resolved = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        channel.presence.unsubscribe(onPresenceEvent);
      }
    };

    const onPresenceEvent = async (message: Ably.PresenceMessage) => {
      if (resolved) return;
      if (message.action !== "enter" && message.action !== "present") {
        return;
      }
      const server = extractServerFromPresence(message);
      if (!server) return;
      if (await isReachable(server.endpoint)) {
        if (resolved) return;
        onLog?.(`Found live server at ${server.endpoint}`);
        cleanup();
        resolve(server);
      } else {
        onLog?.(`Ignoring unreachable presence: ${server.endpoint}`);
      }
    };

    channel.presence.subscribe(onPresenceEvent);

    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        onLog?.("No server found within timeout");
        cleanup();
        resolve(null);
      }
    }, timeoutMs);
  });
}

/**
 * Quickly probe whether an endpoint is actually reachable. Uses OPTIONS
 * (the demo server responds with 204 + CORS headers) so the probe is
 * cheap and side-effect free.
 */
async function isReachable(
  endpoint: string,
  probeTimeoutMs = 750,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), probeTimeoutMs);
    const res = await fetch(endpoint, {
      method: "OPTIONS",
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Any non-5xx response means something is listening.
    return res.status < 500;
  } catch {
    return false;
  }
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
