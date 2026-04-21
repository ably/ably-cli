/**
 * Shared theme constants for the demo TUI.
 * Consistent with the CLI's existing chalk color scheme.
 */

export const colors = {
  /** Primary elements — command names, resources */
  primary: "cyan",
  /** Success messages */
  success: "green",
  /** Warnings */
  warning: "yellow",
  /** Error messages */
  error: "red",
  /** User messages */
  user: "white",
  /** Assistant/agent messages */
  assistant: "whiteBright",
  /** Timestamps and secondary info */
  dim: "gray",
  /** Event types and labels */
  event: "yellow",
  /** Client ID / user identity */
  clientId: "blue",
  /** Panel borders */
  border: "gray",
  /** Active/highlighted border */
  activeBorder: "cyan",
  /** Header text */
  header: "bold",
} as const;

export const symbols = {
  /** Server listening indicator */
  listening: "●",
  /** Incoming message */
  incoming: "←",
  /** Outgoing message/token */
  outgoing: "→",
  /** Warning */
  warn: "⚠",
  /** Feature highlight */
  feature: "⚡",
} as const;
