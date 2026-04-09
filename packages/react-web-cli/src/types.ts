/**
 * Shared type definitions for the react-web-cli package.
 * Replaces `any` casts with proper types for type safety.
 */

import type { ConnectionStatus } from "./AblyCliTerminal";

/**
 * Control messages sent from the server over WebSocket.
 */
export interface ControlMessageHello {
  type: "hello";
  sessionId: string;
}

export interface ControlMessageStatus {
  type: "status";
  payload: string;
  reason?: string;
  code?: number;
}

export type ControlMessage = ControlMessageHello | ControlMessageStatus;

/**
 * Terminal instance augmented with connection tracking fields.
 * xterm.js Terminal instances are extended at runtime with these properties.
 */
export interface TerminalWithConnectingState {
  _connectingLine?: number;
  _connectingMessageLength?: number;
}

/**
 * Global augmentation for debug flags and test helpers injected at runtime.
 */
export interface AblyCliGlobals {
  ABLY_CLI_DEBUG?: boolean;
  ablyCliSocket?: WebSocket;
  setWindowTestFlagOnStatusChange?: (status: ConnectionStatus) => void;
  getAblyCliTerminalReactState?: () => Record<string, unknown>;
  getTerminalBufferText?: () => string;
  getTerminalBufferInfo?: () => Record<string, unknown>;
  /** CI auth token injected during E2E test execution */
  __ABLY_CLI_CI_AUTH_TOKEN__?: string;
  __ABLY_CLI_CI_MODE__?: string;
  __ABLY_CLI_TEST_GROUP__?: string;
  __ABLY_CLI_RUN_ID__?: string;
}

/**
 * WebSocket message data types the browser may deliver.
 */
export type WebSocketMessageData =
  | string
  | Blob
  | ArrayBuffer
  | ArrayBufferView;
