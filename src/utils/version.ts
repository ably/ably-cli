/**
 * Common utilities for version-related functionality
 */
// Import package.json directly - TypeScript will resolve this at compile time
import packageJson from "../../package.json" with { type: "json" };
import isWebCliMode from "./web-mode.js";

/**
 * Get the CLI version from package.json
 * @returns The CLI version string
 */
export function getCliVersion(): string {
  return packageJson.version;
}

/**
 * Agent name used in Ably-Agent headers and SDK agents option. Distinguishes
 * traffic from the local CLI vs the hosted Web CLI so it can be attributed
 * separately in Ably's analytics.
 */
export function getAgentName(): string {
  return isWebCliMode() ? "ably-web-cli" : "ably-cli";
}

/**
 * Get standardized version information object
 */
export function getVersionInfo(config: {
  version: string;
  name: string;
  arch: string;
}): {
  version: string;
  name: string;
  arch: string;
  nodeVersion: string;
  platform: string;
} {
  return {
    version: config.version,
    name: config.name,
    arch: config.arch,
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/**
 * Format version info as a standard string
 */
export function formatVersionString(config: {
  version: string;
  name: string;
  arch: string;
}): string {
  return `${config.name}/${config.version} ${process.platform}-${config.arch} ${process.version}`;
}
