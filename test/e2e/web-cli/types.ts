/**
 * Type definition for the extended window object in web-cli E2E tests.
 * The web-cli injects several globals onto `window` for terminal state
 * inspection and WebSocket control during tests.
 */
export interface AblyCliWindow extends Window {
  /** The WebSocket connection to the terminal server */
  ablyCliSocket?: WebSocket;
  /** Returns the React state of the terminal component */
  getAblyCliTerminalReactState?: () => {
    connectionStatus?: string;
    [key: string]: unknown;
  };
  /** The current terminal session ID */
  _sessionId?: string;
  /** Console log capture array, set up by tests for diagnostics */
  __consoleLogs?: Array<{ type: string; args: string[] }>;
  /** WebSocket control object injected via addInitScript for reconnection tests */
  __wsCtl?: {
    closeAll: () => void;
    count: () => number;
  };
  /** Override WebSocket URL for domain-scoped auth tests */
  __ABLY_CLI_WEBSOCKET_URL__?: string;
  /** Returns terminal buffer info for prompt integrity tests */
  getTerminalBufferInfo?: () => { exists: boolean; [key: string]: unknown };
}
