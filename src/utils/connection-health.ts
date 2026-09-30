import type * as Ably from "@ably/pubsub-core";

import { errorWithReason } from "./errors.js";

/** Consecutive unstable drops after which a connection counts as dead. */
export const MAX_UNSTABLE_DROPS = 5;

/** How long a connection must stay up for its next drop to start a new count. */
export const STABLE_CONNECTION_MS = 10_000;

/**
 * Watches a connection's state changes and reports, once, when it has died:
 * either it failed (a terminal state the SDK never leaves), or it keeps
 * dropping without staying connected. The second is how a server-side
 * rejection such as an eviction can present, as a loop the SDK retries
 * forever rather than an error.
 */
export class ConnectionHealthMonitor {
  private connectedAt: number | undefined;
  private unstableDrops = 0;
  private reported = false;

  constructor(
    private readonly onDead: (error: Error) => void,
    private readonly now: () => number = Date.now,
  ) {}

  handle(change: Ably.ConnectionStateChange): void {
    switch (change.current) {
      case "connected": {
        this.connectedAt = this.now();
        break;
      }

      case "failed": {
        this.report(
          `Connection failed: ${change.reason?.message ?? "Unknown error"}`,
          change.reason,
        );
        break;
      }

      case "disconnected":
      case "suspended": {
        const wasStable =
          this.connectedAt !== undefined &&
          this.now() - this.connectedAt >= STABLE_CONNECTION_MS;
        this.unstableDrops = wasStable ? 1 : this.unstableDrops + 1;
        this.connectedAt = undefined;

        if (this.unstableDrops >= MAX_UNSTABLE_DROPS) {
          this.report(
            `Connection lost ${this.unstableDrops} times in a row without staying connected${change.reason ? `: ${change.reason.message}` : ""}`,
            change.reason,
          );
        }
        break;
      }
    }
  }

  private report(message: string, reason?: Ably.ErrorInfo | null): void {
    if (this.reported) return;
    this.reported = true;
    this.onDead(errorWithReason(message, reason));
  }
}
