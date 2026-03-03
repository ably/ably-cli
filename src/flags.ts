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
 * Hidden flags for product API (Ably SDK) commands — port, tls, tlsPort.
 */
export const hiddenProductApiFlags = {
  port: Flags.integer({
    description: "Override the port for product API calls",
    hidden: process.env.ABLY_SHOW_DEV_FLAGS !== "true",
  }),
  tlsPort: Flags.integer({
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
 * client-id flag for commands that support it (e.g., presence).
 */
export const clientIdFlag = {
  "client-id": Flags.string({
    description:
      'Overrides any default client ID when using API authentication. Use "none" to explicitly set no client ID. Not applicable when using token authentication.',
  }),
};

/**
 * endpoint flag for login / accounts switch commands only.
 */
export const endpointFlag = {
  endpoint: Flags.string({
    description:
      "Set a custom endpoint for all product API calls, stored in account config",
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
