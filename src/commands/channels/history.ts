import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../flags.js";
import { formatMessagesOutput, toMessageJson } from "../../utils/output.js";
import type { MessageDisplayFields } from "../../utils/output.js";
import { parseTimestamp } from "../../utils/time.js";

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
      const historyParams: Ably.RealtimeHistoryParams = {
        direction: flags.direction as "backwards" | "forwards",
        limit: flags.limit,
      };

      // Add time range if specified
      if (flags.start) {
        historyParams.start = parseTimestamp(flags.start, "start");
      }

      if (flags.end) {
        historyParams.end = parseTimestamp(flags.end, "end");
      }

      if (
        historyParams.start !== undefined &&
        historyParams.end !== undefined &&
        historyParams.start > historyParams.end
      ) {
        this.error("--start must be earlier than or equal to --end");
      }

      // Get history
      const history = await channel.history(historyParams);
      const messages = history.items;

      // Build MessageDisplayFields array from history results
      const displayMessages: MessageDisplayFields[] = messages.map(
        (message, index) => ({
          channel: channelName,
          clientId: message.clientId,
          data: message.data,
          event: message.name || "(none)",
          id: message.id,
          indexPrefix: `[${index + 1}]`,
          serial: (message as Record<string, unknown>).serial as
            | string
            | undefined,
          timestamp: message.timestamp
            ? new Date(message.timestamp).toISOString()
            : new Date().toISOString(),
        }),
      );

      // Display results based on format
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            displayMessages.map((msg) => toMessageJson(msg)),
            flags,
          ),
        );
      } else {
        if (displayMessages.length === 0) {
          this.log(formatMessagesOutput([]));
          return;
        }

        this.log(formatMessagesOutput(displayMessages));

        if (messages.length === flags.limit) {
          this.log("");
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
