import { Flags } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../../flags.js";
import { formatMessageData } from "../../../utils/json-formatter.js";
import { buildHistoryParams } from "../../../utils/history.js";
import {
  formatCountLabel,
  formatIndex,
  formatTimestamp,
  formatMessageTimestamp,
  formatLimitWarning,
} from "../../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationWarning,
} from "../../../utils/pagination.js";

export default class LogsConnectionLifecycleHistory extends AblyBaseCommand {
  static override description = "Retrieve connection lifecycle log history";

  static override examples = [
    "$ ably logs connection-lifecycle history",
    "$ ably logs connection-lifecycle history --limit 20",
    "$ ably logs connection-lifecycle history --direction forwards",
    "$ ably logs connection-lifecycle history --json",
    "$ ably logs connection-lifecycle history --pretty-json",
    '$ ably logs connection-lifecycle history --start "2023-01-01T00:00:00Z" --end "2023-01-02T00:00:00Z"',
    "$ ably logs connection-lifecycle history --start 1h",
  ];

  static override flags = {
    ...productApiFlags,
    ...timeRangeFlags,
    direction: Flags.string({
      default: "backwards",
      description: "Direction of log retrieval",
      options: ["backwards", "forwards"],
    }),
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return (default: 100)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LogsConnectionLifecycleHistory);

    try {
      // Create a REST client
      const client = await this.createAblyRestClient(flags);
      if (!client) {
        return;
      }

      // Get the channel
      const channel = client.channels.get("[meta]connection.lifecycle");

      // Build history query parameters
      const historyParams = buildHistoryParams(flags);

      // Get history
      const history = await channel.history(historyParams);
      const {
        items: messages,
        hasMore,
        pagesConsumed,
      } = await collectPaginatedResults(history, flags.limit);

      const paginationWarning = formatPaginationWarning(
        pagesConsumed,
        messages.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.log(paginationWarning);
      }

      // Output results based on format
      if (this.shouldOutputJson(flags)) {
        const lastTimestamp =
          messages.length > 0 ? messages.at(-1)!.timestamp : undefined;
        const next = buildPaginationNext(hasMore, lastTimestamp);
        this.logJsonResult(
          {
            hasMore,
            messages: messages.map((msg) => ({
              clientId: msg.clientId,
              connectionId: msg.connectionId,
              data: msg.data,
              encoding: msg.encoding,
              id: msg.id,
              name: msg.name,
              timestamp: formatMessageTimestamp(msg.timestamp),
            })),
            ...(next && { next }),
          },
          flags,
        );
      } else {
        if (messages.length === 0) {
          this.log("No connection lifecycle logs found in history.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(messages.length, "connection lifecycle log")}:`,
        );
        this.log("");

        for (const [index, message] of messages.entries()) {
          const timestampDisplay = message.timestamp
            ? formatTimestamp(formatMessageTimestamp(message.timestamp))
            : chalk.dim("[Unknown timestamp]");

          this.log(`${formatIndex(index + 1)} ${timestampDisplay}`);

          // Event name
          if (message.name) {
            let color = chalk.white;

            // Color-code the event name based on type
            if (
              message.name.includes("opened") ||
              message.name.includes("connected")
            ) {
              color = chalk.green;
            } else if (
              message.name.includes("closed") ||
              message.name.includes("disconnected")
            ) {
              color = chalk.yellow;
            } else if (
              message.name.includes("failed") ||
              message.name.includes("error")
            ) {
              color = chalk.red;
            } else if (message.name.includes("suspended")) {
              color = chalk.magenta;
            }

            this.log(`Event: ${color(message.name)}`);
          }

          // Display message data
          if (message.data) {
            this.log("Data:");
            this.log(formatMessageData(message.data));
          }

          this.log("");
        }

        if (hasMore) {
          const warning = formatLimitWarning(
            messages.length,
            flags.limit,
            "logs",
          );
          if (warning) this.log(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "connectionLifecycleHistory");
    }
  }
}
