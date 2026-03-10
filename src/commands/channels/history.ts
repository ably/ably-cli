import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../flags.js";
import { buildHistoryParams } from "../../utils/history.js";
import { errorMessage } from "../../utils/errors.js";
import {
  formatMessagesOutput,
  formatTimestamp,
  formatMessageTimestamp,
  limitWarning,
  toMessageJson,
} from "../../utils/output.js";
import type { MessageDisplayFields } from "../../utils/output.js";

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

      // Build display fields from history results
      const displayMessages: MessageDisplayFields[] = messages.map(
        (message, index) => ({
          channel: channelName,
          clientId: message.clientId,
          data: message.data,
          event: message.name || "(none)",
          id: message.id,
          indexPrefix: `[${index + 1}] ${formatTimestamp(formatMessageTimestamp(message.timestamp))}`,
          serial: message.serial,
          timestamp: message.timestamp ?? Date.now(),
          version: message.version,
          annotations: message.annotations,
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
        this.log(formatMessagesOutput(displayMessages));

        const warning = limitWarning(messages.length, flags.limit, "messages");
        if (warning) this.log(warning);
      }
    } catch (error) {
      const errorMsg = `Error retrieving channel history: ${errorMessage(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
