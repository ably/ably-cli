/** Standardized status values for `logJsonStatus` in subscribe and hold commands. */
export enum JsonStatusType {
  /** Command is establishing connection / attaching to resource */
  Subscribing = "subscribing",
  /** Successfully attached and actively listening for events */
  Listening = "listening",
  /** Command is holding state (presence, lock, cursor) until Ctrl+C */
  Holding = "holding",
  /** Duration elapsed or command finished cleanly */
  Complete = "complete",
  /** Non-fatal warning (disconnection, retry, partial failure) */
  Warning = "warning",
  /** Disconnected from Ably, will attempt to reconnect */
  Disconnected = "disconnected",
}
