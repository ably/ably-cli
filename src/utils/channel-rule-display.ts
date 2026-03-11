import chalk from "chalk";

import type { Namespace } from "../services/control-api.js";

function boolField(value: boolean | undefined): string {
  return value ? chalk.green("Yes") : "No";
}

function boolFieldBold(value: boolean | undefined): string {
  return value ? chalk.bold.green("✓ Yes") : "No";
}

/**
 * Format channel rule details for human-readable output.
 * Returns an array of pre-formatted lines.
 *
 * @param rule - The namespace/channel rule to display
 * @param options.indent - Prefix for each line (e.g. "  " for list items)
 * @param options.bold - Use bold green checkmarks (for list display)
 * @param options.showTimestamps - Include created/modified timestamps
 * @param options.formatDate - Function to format timestamps
 */
export function formatChannelRuleDetails(
  rule: Namespace,
  options: {
    bold?: boolean;
    formatDate?: (timestamp: number) => string;
    indent?: string;
    showTimestamps?: boolean;
  } = {},
): string[] {
  const {
    bold = false,
    formatDate,
    indent = "",
    showTimestamps = true,
  } = options;
  const bool = bold ? boolFieldBold : boolField;
  const lines: string[] = [];

  lines.push(
    `${indent}Persisted: ${bool(rule.persisted)}`,
    `${indent}Push Enabled: ${bool(rule.pushEnabled)}`,
  );

  if (rule.mutableMessages !== undefined) {
    lines.push(`${indent}Mutable Messages: ${bool(rule.mutableMessages)}`);
  }

  if (rule.authenticated !== undefined) {
    lines.push(`${indent}Authenticated: ${bool(rule.authenticated)}`);
  }

  if (rule.persistLast !== undefined) {
    lines.push(
      `${indent}Persist Last${bold ? " Message" : ""}: ${bool(rule.persistLast)}`,
    );
  }

  if (rule.exposeTimeSerial !== undefined) {
    lines.push(`${indent}Expose Time Serial: ${bool(rule.exposeTimeSerial)}`);
  }

  if (rule.populateChannelRegistry !== undefined) {
    lines.push(
      `${indent}Populate Channel Registry: ${bool(rule.populateChannelRegistry)}`,
    );
  }

  if (rule.batchingEnabled !== undefined) {
    lines.push(`${indent}Batching Enabled: ${bool(rule.batchingEnabled)}`);
  }

  if (
    typeof rule.batchingInterval === "number" &&
    rule.batchingInterval !== 0
  ) {
    lines.push(
      `${indent}Batching Interval: ${bold ? chalk.bold.green(`✓ ${rule.batchingInterval}`) : chalk.green(rule.batchingInterval.toString())}`,
    );
  }

  if (rule.conflationEnabled !== undefined) {
    lines.push(`${indent}Conflation Enabled: ${bool(rule.conflationEnabled)}`);
  }

  if (
    typeof rule.conflationInterval === "number" &&
    rule.conflationInterval !== 0
  ) {
    lines.push(
      `${indent}Conflation Interval: ${bold ? chalk.bold.green(`✓ ${rule.conflationInterval}`) : chalk.green(rule.conflationInterval.toString())}`,
    );
  }

  if (rule.conflationKey && rule.conflationKey !== "") {
    lines.push(
      `${indent}Conflation Key: ${bold ? chalk.bold.green(`✓ ${rule.conflationKey}`) : chalk.green(rule.conflationKey)}`,
    );
  }

  if (rule.tlsOnly !== undefined) {
    lines.push(`${indent}TLS Only: ${bool(rule.tlsOnly)}`);
  }

  if (showTimestamps && formatDate) {
    lines.push(`${indent}Created: ${formatDate(rule.created)}`);
    if (rule.modified) {
      lines.push(`${indent}Updated: ${formatDate(rule.modified)}`);
    }
  }

  return lines;
}
