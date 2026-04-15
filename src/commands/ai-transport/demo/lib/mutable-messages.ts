/**
 * Mutable messages detection for AI Transport demos.
 *
 * AI Transport requires mutable messages to be enabled on the channel
 * namespace. This module provides two detection paths:
 *
 * Path 1 (Control API): Check namespace config via the Control API.
 *   Requires an access token (from `ably login`).
 *
 * Path 2 (Data plane): Publish a test message and attempt to annotate it.
 *   If error 93002 is returned, mutable messages is not enabled.
 *   Works with just an API key.
 */

import type { ControlApi, Namespace } from "../../../../services/control-api.js";
import type * as Ably from "ably";

/** Error code returned when mutable messages is not enabled. */
const MUTABLE_MESSAGES_ERROR_CODE = 93002;

export interface MutableMessagesCheckResult {
  enabled: boolean;
  method: "control-api" | "data-plane";
}

/**
 * Extract the namespace prefix from a channel name.
 * For "ai-demo:streaming-abc", returns "ai-demo".
 * For "streaming-abc" (no colon), returns "" (default namespace).
 */
export function extractNamespace(channelName: string): string {
  const colonIndex = channelName.indexOf(":");
  if (colonIndex === -1) return "";
  return channelName.slice(0, colonIndex);
}

/**
 * Check if mutable messages is enabled via the Control API.
 * Returns null if Control API is not available.
 */
export async function checkViaControlApi(
  controlApi: ControlApi,
  appId: string,
  namespace: string,
): Promise<MutableMessagesCheckResult | null> {
  try {
    const namespaces: Namespace[] =
      await controlApi.listNamespaces(appId);
    const match = namespaces.find((ns) => ns.id === namespace);

    if (!match) {
      // Namespace doesn't exist at all — mutable messages is not enabled
      return { enabled: false, method: "control-api" };
    }

    return {
      enabled: match.mutableMessages === true,
      method: "control-api",
    };
  } catch {
    // Control API not available (no token, network error, etc.)
    return null;
  }
}

/**
 * Check if mutable messages is enabled via a data plane smoke test.
 * Publishes a test message then tries to append to it (which requires
 * mutable messages). Error 93002 means mutable messages is not enabled.
 */
export async function checkViaDataPlane(
  channel: Ably.RealtimeChannel,
): Promise<MutableMessagesCheckResult> {
  try {
    // Publish a test message
    const testMessageName = "__ait-demo-mutable-check__";
    await channel.publish(testMessageName, "test");

    // Try to append to it — this requires mutable messages
    try {
      await channel.appendMessage(
        { name: testMessageName, data: "append-test" },
      );
    } catch (error: unknown) {
      if (isAblyError(error, MUTABLE_MESSAGES_ERROR_CODE)) {
        return { enabled: false, method: "data-plane" };
      }

      // Some other error — could be permissions, missing message, etc.
      // Default to assuming it might work (let the real operation fail
      // with a better error)
      return { enabled: true, method: "data-plane" };
    }

    return { enabled: true, method: "data-plane" };
  } catch (error: unknown) {
    if (isAblyError(error, MUTABLE_MESSAGES_ERROR_CODE)) {
      return { enabled: false, method: "data-plane" };
    }

    // Can't determine — assume it works and let the real operation fail
    return { enabled: true, method: "data-plane" };
  }
}

/**
 * Enable mutable messages on a namespace via the Control API.
 */
export async function enableMutableMessages(
  controlApi: ControlApi,
  appId: string,
  namespace: string,
): Promise<void> {
  const namespaces = await controlApi.listNamespaces(appId);
  const existing = namespaces.find((ns) => ns.id === namespace);

  if (existing) {
    // Update existing namespace
    await controlApi.updateNamespace(appId, namespace, {
      mutableMessages: true,
      persisted: true, // Required when mutableMessages is enabled
    });
  } else {
    // Create new namespace
    await controlApi.createNamespace(appId, {
      id: namespace,
      mutableMessages: true,
      persisted: true,
    });
  }
}

function isAblyError(error: unknown, code: number): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === code
  ) {
    return true;
  }

  // Check nested statusCode / code patterns
  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error
  ) {
    return isAblyError((error as { cause: unknown }).cause, code);
  }

  return false;
}
