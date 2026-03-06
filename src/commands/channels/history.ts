import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../flags.js";
import { formatJson, isJsonData } from "../../utils/json-formatter.js";
import { buildHistoryParams } from "../../utils/history.js";
import {
  formatTimestamp,
  formatMessageTimestamp,
  resource,
} from "../../utils/output.js";

export default class ChannelsHistory extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to retrieve history for",
      required: true,
    }),
  };

  static override description = "Retrieve message history for a channel";

  static override examples = [
    "$ ably channels history my-channel",
    "$ ably channels history my-channel --json",
    "$ ably channels history my-channel --pretty-json",
    '$ ably channels history my-channel --start "2023-01-01T00:00:00Z" --end "2023-01-02T00:00:00Z"',
    "$ ably channels history my-channel --start 1h",
    "$ ably channels history my-channel --limit 100",
    "$ ably channels history my-channel --direction forward",
  ];

  static override flags = {
    ...productApiFlags,
    cipher: Flags.string({
      description: "Decryption key for encrypted messages (AES-128)",
    }),
    direction: Flags.string({
      default: "backwards",
      description: "Direction of message retrieval (default: backwards)",
      options: ["backwards", "forwards"],
    }),

    ...timeRangeFlags,
    limit: Flags.integer({
      default: 50,
      description: "Maximum number of results to return (default: 50)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsHistory);
    const channelName = args.channel;
    let client: Ably.Rest | null;

    try {
      // Create a REST client
      client = await this.createAblyRestClient(flags);
      if (!client) {
        return;
      }

      // Setup channel options
      const channelOptions: Ably.ChannelOptions = {};

      // Add encryption if specified
      if (flags.cipher) {
        channelOptions.cipher = {
          key: flags.cipher,
        };
      }

      // Get the channel with options
      const channel = client.channels.get(channelName, channelOptions);

      // Build history query parameters
      const historyParams = buildHistoryParams(flags);

      // Get history
      const history = await channel.history(historyParams);
      const messages = history.items;

      // Display results based on format
      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput({ messages }, flags));
      } else {
        if (messages.length === 0) {
          this.log("No messages found in the channel history.");
          return;
        }

        this.log(
          `Found ${chalk.cyan(messages.length.toString())} ${messages.length === 1 ? "message" : "messages"} in the history of channel: ${resource(channelName)}`,
        );
        this.log("");

        for (const [index, message] of messages.entries()) {
          const timestampDisplay = message.timestamp
            ? formatTimestamp(formatMessageTimestamp(message.timestamp))
            : chalk.dim("[Unknown timestamp]");

          this.log(`${chalk.dim(`[${index + 1}]`)} ${timestampDisplay}`);
          this.log(
            `${chalk.dim("Event:")} ${chalk.yellow(message.name || "(none)")}`,
          );

          if (message.clientId) {
            this.log(
              `${chalk.dim("Client ID:")} ${chalk.blue(message.clientId)}`,
            );
          }

          this.log(chalk.dim("Data:"));
          if (isJsonData(message.data)) {
            this.log(formatJson(message.data));
          } else {
            this.log(String(message.data));
          }

          this.log("");
        }

        if (messages.length === flags.limit) {
          this.log(
            chalk.yellow(
              `Showing maximum of ${flags.limit} messages. Use --limit to show more.`,
            ),
          );
        }
      }
    } catch (error) {
      const errorMsg = `Error retrieving channel history: ${error instanceof Error ? error.message : String(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
