import { Flags } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../../flags.js";
import { formatJson, isJsonData } from "../../../utils/json-formatter.js";
import { buildHistoryParams } from "../../../utils/history.js";
import {
  formatTimestamp,
  formatMessageTimestamp,
} from "../../../utils/output.js";

export default class LogsPushHistory extends AblyBaseCommand {
  static override description = "Retrieve push notification log history";

  static override examples = [
    "$ ably logs push history",
    "$ ably logs push history --limit 20",
    "$ ably logs push history --direction forwards",
    "$ ably logs push history --json",
    "$ ably logs push history --pretty-json",
    '$ ably logs push history --start "2023-01-01T00:00:00Z" --end "2023-01-02T00:00:00Z"',
    "$ ably logs push history --start 1h",
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
    const { flags } = await this.parse(LogsPushHistory);

    try {
      // Create a REST client
      const client = await this.createAblyRestClient(flags);
      if (!client) {
        return;
      }

      const channelName = "[meta]log:push";
      const channel = client.channels.get(channelName);

      // Get message history
      const historyOptions = buildHistoryParams(flags);

      const historyPage = await channel.history(historyOptions);
      const messages = historyPage.items;

      // Output results based on format
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              messages: messages.map((msg) => ({
                channel: channelName,
                clientId: msg.clientId,
                connectionId: msg.connectionId,
                data: msg.data,
                encoding: msg.encoding,
                id: msg.id,
                name: msg.name,
                timestamp: formatMessageTimestamp(msg.timestamp),
              })),
              success: true,
            },
            flags,
          ),
        );
      } else {
        if (messages.length === 0) {
          this.log("No push log messages found in history.");
          return;
        }

        this.log(
          `Found ${chalk.cyan(messages.length.toString())} push log messages:`,
        );
        this.log("");

        for (const [index, message] of messages.entries()) {
          const timestampDisplay = message.timestamp
            ? formatTimestamp(formatMessageTimestamp(message.timestamp))
            : chalk.dim("[Unknown timestamp]");
          const event = message.name || "unknown";

          // Color-code different event types based on severity
          let eventColor = chalk.blue;

          // For push log events - based on examples and severity
          if (
            message.data &&
            typeof message.data === "object" &&
            "severity" in message.data
          ) {
            const severity = message.data.severity as string;
            switch (severity) {
              case "error": {
                eventColor = chalk.red;

                break;
              }

              case "warning": {
                eventColor = chalk.yellow;

                break;
              }

              case "info": {
                eventColor = chalk.green;

                break;
              }

              case "debug": {
                eventColor = chalk.blue;

                break;
              }
              // No default
            }
          }

          // Format the log output
          this.log(
            `${chalk.dim(`[${index + 1}]`)} ${timestampDisplay} Channel: ${chalk.cyan(channelName)} | Event: ${eventColor(event)}`,
          );
          if (message.data) {
            this.log(chalk.dim("Data:"));
            if (isJsonData(message.data)) {
              this.log(formatJson(message.data));
            } else {
              this.log(String(message.data));
            }
          }

          this.log("");
        }

        if (messages.length === flags.limit) {
          this.log(
            chalk.yellow(
              `Showing maximum of ${flags.limit} logs. Use --limit to show more.`,
            ),
          );
        }
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: error instanceof Error ? error.message : String(error),
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          `Error retrieving push notification logs: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
