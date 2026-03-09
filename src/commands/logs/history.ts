import { Flags } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../flags.js";
import { formatMessageData } from "../../utils/json-formatter.js";
import { errorMessage } from "../../utils/errors.js";
import { buildHistoryParams } from "../../utils/history.js";
import {
  formatCountLabel,
  formatIndex,
  formatTimestamp,
  formatMessageTimestamp,
  formatLimitWarning,
} from "../../utils/output.js";

export default class LogsHistory extends AblyBaseCommand {
  static override description = "Retrieve application log history";

  static override examples = [
    "$ ably logs history",
    "$ ably logs history --limit 20",
    "$ ably logs history --direction forwards",
    "$ ably logs history --json",
    "$ ably logs history --pretty-json",
    '$ ably logs history --start "2023-01-01T00:00:00Z" --end "2023-01-02T00:00:00Z"',
    "$ ably logs history --start 1h",
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
    const { flags } = await this.parse(LogsHistory);

    try {
      // Create a REST client
      const client = await this.createAblyRestClient(flags);
      if (!client) {
        return;
      }

      // Get the channel
      const channel = client.channels.get("[meta]log");

      // Build history query parameters
      const historyParams = buildHistoryParams(flags);

      // Get history
      const history = await channel.history(historyParams);
      const messages = history.items;

      // Output results based on format
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              messages: messages.map((msg) => ({
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
          this.log("No application logs found in history.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(messages.length, "application log")}:`,
        );
        this.log("");

        for (const [index, message] of messages.entries()) {
          const timestampDisplay = message.timestamp
            ? formatTimestamp(formatMessageTimestamp(message.timestamp))
            : chalk.dim("[Unknown timestamp]");

          this.log(`${formatIndex(index + 1)} ${timestampDisplay}`);

          // Event name
          if (message.name) {
            const color = this.getColorForEventName(message.name);
            this.log(`Event: ${color(message.name)}`);
          }

          // Display message data
          if (message.data) {
            this.log("Data:");
            this.log(formatMessageData(message.data));
          }

          this.log("");
        }

        const warning = formatLimitWarning(
          messages.length,
          flags.limit,
          "logs",
        );
        if (warning) this.log(warning);
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: errorMessage(error),
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error retrieving application logs: ${errorMessage(error)}`);
      }
    }
  }

  // Helper function to determine chalk color based on event name
  private getColorForEventName(eventName: string) {
    if (eventName.includes("success")) {
      return chalk.green;
    }

    if (eventName.includes("failed") || eventName.includes("error")) {
      return chalk.red;
    }

    if (eventName.includes("warning")) {
      return chalk.yellow;
    }

    return chalk.white; // Default color
  }
}
