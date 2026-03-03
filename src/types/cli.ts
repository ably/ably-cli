import { Config } from "@oclif/core";
import * as Ably from "ably";

/**
 * Base interface for CLI flags.
 */
export interface BaseFlags {
  "api-key"?: string; // Not a CLI flag; set internally by ensureAppAndKey
  "client-id"?: string;
  "control-host"?: string;
  "dashboard-host"?: string;
  endpoint?: string;
  port?: number;
  tls?: string;
  tlsPort?: number;
  json?: boolean;
  "pretty-json"?: boolean;
  verbose?: boolean;
  "web-cli-help"?: boolean;
  format?: string;
  "token-only"?: boolean;
  quiet?: boolean;
  app?: string;
  [key: string]: unknown;
}

/**
 * Error details structure for formatted output
 * Compatible with Ably's ErrorInfo
 */
export type ErrorDetails =
  | Ably.ErrorInfo
  | {
      code?: number;
      message?: string;
      statusCode?: number;
      [key: string]: unknown;
    };

/**
 * Command configuration type - using any for now to avoid type conflicts
 */
export type CommandConfig = Config;

/**
 * Arguments type for CLI commands
 */
export interface CommandArgs {
  [key: string]: string | undefined;
}
