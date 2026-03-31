/**
 * Shared type definitions for bench command data payloads.
 *
 * The Ably SDK types `Message.data` and `PresenceMessage.data` as `any`.
 * These interfaces allow us to cast the data at the point of use so that
 * property accesses are type-safe and satisfy the `no-unsafe-*` ESLint rules.
 */

/** Data shape published on presence by bench participants. */
export interface BenchPresenceData {
  role: "publisher" | "subscriber";
  testDetails?: Record<string, unknown>;
  testId?: string;
}

/** Data shape of benchmark messages (type: "message"). */
export interface BenchMessageData {
  index?: number;
  msgId: string;
  padding?: string;
  testId: string;
  timestamp: number;
  type: "end" | "message" | "start";
  startTime?: number;
  messageCount?: number;
  messageRate?: number;
  transport?: string;
}
