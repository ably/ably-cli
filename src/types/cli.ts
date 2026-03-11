import { Config } from "@oclif/core";

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
  "tls-port"?: number;
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
 * Command configuration type - using any for now to avoid type conflicts
 */
export type CommandConfig = Config;

/**
 * Arguments type for CLI commands
 */
export interface CommandArgs {
  [key: string]: string | undefined;
}
