/**
 * Ably's internal EventEmitter for use in mock helpers.
 *
 * Ably SDKs use their own EventEmitter implementation with on/off/once/emit methods.
 * This module provides access to that EventEmitter for creating mocks that match
 * the real SDK behavior.
 */

import { createRealtimeClient } from "@ably/pubsub-server";

/**
 * Type for Ably's EventEmitter instance.
 */
export interface AblyEventEmitter {
  on(event: string | null, listener: (...args: unknown[]) => void): void;
  off(event?: string | null, listener?: (...args: unknown[]) => void): void;
  once(event: string | null, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

/**
 * Ably's internal EventEmitter constructor.
 * Access it from the realtime client class where it's exposed internally. The
 * server package exports only factories, so reach the class through an
 * unconnected client's constructor.
 */
const realtimeClient = createRealtimeClient({
  key: "appId.keyId:keySecret",
  autoConnect: false,
});
export const EventEmitter = (
  realtimeClient.constructor as unknown as {
    EventEmitter: new () => AblyEventEmitter;
  }
).EventEmitter;
realtimeClient.close();
