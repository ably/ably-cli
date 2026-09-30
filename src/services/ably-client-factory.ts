import type * as Ably from "@ably/pubsub-core";
import { createClient as createDeviceClient } from "@ably/pubsub-device";
import {
  createHttpClient as createServerHttpClient,
  createRealtimeClient as createServerRealtimeClient,
} from "@ably/pubsub-server";
import jwt from "jsonwebtoken";

/**
 * Which side of an Ably connection a client declares itself to be on, for MAU
 * classification. Server traffic is exempt from MAU counting; device traffic
 * is counted per clientId.
 */
export type ClientSide = "server" | "device";

/**
 * The signed JWT claim Ably reads to grant a token-authenticated client the
 * server side. Under token auth the server side is granted only through this
 * claim; a client that declares itself a server without it is rejected.
 */
export const CLIENT_TYPE_CLAIM = "x-ably-clientType";

/**
 * The CLI is a server by default: API-key auth always declares the server
 * side. Under token auth the token decides, because an unsigned server
 * declaration is rejected — a JWT carrying `x-ably-clientType=server` is a
 * server, anything else (other JWTs, native Ably tokens) is a device.
 */
export function resolveClientSide(
  options: Pick<Ably.ClientOptions, "token">,
): ClientSide {
  if (!options.token) return "server";
  return typeof options.token === "string" && tokenHasServerClaim(options.token)
    ? "server"
    : "device";
}

/**
 * Whether a token is a JWT carrying the server claim. Native Ably tokens are
 * opaque and cannot carry the claim, so they always return false.
 */
export function tokenHasServerClaim(token: string): boolean {
  const payload = jwt.decode(token, { json: true });
  return payload?.[CLIENT_TYPE_CLAIM] === "server";
}

/**
 * Create an HTTP client. Only servers have one: `@ably/pubsub-device` ships a
 * realtime client only.
 *
 * @throws Error when `side` is "device".
 */
export function createPubSubHttpClient(
  options: Ably.ClientOptions,
  side: ClientSide = resolveClientSide(options),
): Ably.PubSubHttpClient {
  if (side === "device") {
    throw new Error("A device-side client cannot be an HTTP client.");
  }

  return createServerHttpClient(options);
}

export function createPubSubRealtimeClient(
  options: Ably.ClientOptions,
  side: ClientSide = resolveClientSide(options),
): Ably.PubSubRealtimeClient {
  return side === "server"
    ? createServerRealtimeClient(options)
    : createDeviceClient(options);
}
