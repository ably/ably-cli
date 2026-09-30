import { Flags } from "@oclif/core";

/**
 * Core global flags available on every command.
 */
export const coreGlobalFlags = {
  verbose: Flags.boolean({
    char: "v",
    default: false,
    description: "Output verbose logs",
    required: false,
  }),
  json: Flags.boolean({
    description: "Output in JSON format",
    exclusive: ["pretty-json"],
  }),
  "pretty-json": Flags.boolean({
    description: "Output in colorized JSON format",
    exclusive: ["json"],
  }),
  "web-cli-help": Flags.boolean({
    description: "Show help formatted for the web CLI",
    hidden: true,
  }),
};

/**
 * Hidden flags for product API (Ably SDK) commands — url, port, tls, tls-port.
 *
 * `--url` sets host, port and TLS together, which is what pointing at a local
 * server needs. The individual flags below override single fields on top of it.
 */
export const hiddenProductApiFlags = {
  url: Flags.string({
    description:
      "Route product API calls to this URL, e.g. http://localhost:8081",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
  }),
  port: Flags.integer({
    description: "Override the port for product API calls",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
  }),
  "tls-port": Flags.integer({
    description: "Override the TLS port for product API calls",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
  }),
  tls: Flags.string({
    description: "Use TLS for product API calls (default is true)",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
  }),
};

/**
 * Hidden flags for control API commands — control-host, dashboard-host.
 */
export const hiddenControlApiFlags = {
  "control-host": Flags.string({
    description:
      "Override the host endpoint for the control API, which defaults to control.ably.net",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
    env: "ABLY_CONTROL_HOST",
  }),
  "dashboard-host": Flags.string({
    description:
      "Override the host for the Ably dashboard, which defaults to https://ably.com",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
    env: "ABLY_DASHBOARD_HOST",
  }),
};

/**
 * client-id flag for commands where acting as a particular client is part of the operation
 * (e.g., subscribe, publish, enter, update, delete). Read-only queries (get, get-all, occupancy get)
 * don't take it: they still carry the session's client ID (ABLY_CLIENT_ID, config, or the generated
 * default), and Ably counts that ID, but there's no per-command reason to act as someone else.
 *
 * This exact definition is the identity flag: the base command honours
 * `client-id` as the CLI's own identity only when a command declares it via
 * this object. A command-local `client-id` flag (a push target or filter, a
 * token's subject) never changes who the CLI acts as.
 */
export const clientIdFlag = {
  "client-id": Flags.string({
    description:
      "Client ID to act as, overriding ABLY_CLIENT_ID and the configured default. Ignored under token authentication, where the token sets it.",
  }),
};

/**
 * Hidden oauth-host flag for overriding the OAuth authorization server host.
 * Kept separate from --control-host because the OAuth server (ably.com) and
 * the Control API (control.ably.net) are different services and may be
 * overridden independently when targeting review/staging environments.
 */
export const oauthHostFlag = {
  "oauth-host": Flags.string({
    description:
      "Override the host for the OAuth authorization server, which defaults to ably.com",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
    env: "ABLY_OAUTH_HOST",
  }),
};

/**
 * Local server flags for `accounts login` only.
 *
 * `--url` and `--control-url` are full URLs rather than the SDK's separate
 * host/port/tls options: one value is easier to supply and is decomposed by
 * `parseServerUrl()` at login time.
 */
export const localServerFlags = {
  // No default: oclif's dependsOn treats a defaulted flag as always present,
  // which would stop it rejecting --url without --local.
  local: Flags.boolean({
    description:
      "Log in to a locally-running Ably server instead of the managed service",
  }),
  url: Flags.string({
    dependsOn: ["local"],
    description:
      "Data plane URL of the local server (e.g. http://localhost:8081)",
  }),
  "control-url": Flags.string({
    dependsOn: ["local"],
    description:
      "Control plane URL of the local server, if you are running it locally (e.g. http://localhost:8082)",
  }),
};

/**
 * endpoint flag for login / accounts switch commands only.
 */
export const endpointFlag = {
  endpoint: Flags.string({
    description:
      "Set a custom endpoint for all product API calls, stored in account config",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
  }),
};

/**
 * Shared start/end time range flags.
 * Accepts ISO 8601, Unix ms, or relative shorthand (e.g., "1h", "30m", "2d").
 * Parse values with `parseTimestamp()` from `src/utils/time.ts`.
 */
export const timeRangeFlags = {
  end: Flags.string({
    description:
      'End time as ISO 8601, Unix ms, or relative (e.g., "1h", "30m", "2d")',
  }),
  start: Flags.string({
    description:
      'Start time as ISO 8601, Unix ms, or relative (e.g., "1h", "30m", "2d")',
  }),
};

/**
 * Duration flag for long-running subscribe/stream commands.
 * Automatically exits after N seconds.
 */
export const durationFlag = {
  duration: Flags.integer({
    description: "Automatically exit after N seconds",
    char: "D",
    required: false,
  }),
};

/**
 * Force flag for commands that require confirmation.
 */
export const forceFlag = {
  force: Flags.boolean({
    char: "f",
    default: false,
    description: "Skip confirmation prompt (required with --json)",
  }),
};

/**
 * Rewind flag for subscribe commands that support message replay.
 */
export const rewindFlag = {
  rewind: Flags.integer({
    default: 0,
    description: "Number of messages to rewind when subscribing (default: 0)",
  }),
};

/**
 * Composite: core + hidden product API flags.
 * Use for product API commands (channels, connections, logs, bench, etc.)
 */
export const productApiFlags = {
  ...coreGlobalFlags,
  ...hiddenProductApiFlags,
};

/**
 * Composite: core + hidden control API flags.
 * Use for control API commands (accounts, apps, keys, integrations, queues, etc.)
 */
export const controlApiFlags = {
  ...coreGlobalFlags,
  ...hiddenControlApiFlags,
};
