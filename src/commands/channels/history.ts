import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags, timeRangeFlags } from "../../flags.js";
import { buildHistoryParams } from "../../utils/history.js";
import {
  formatTimestamp,
  formatMessageTimestamp,
  formatIndex,
  formatCountLabel,
  formatProgress,
  formatResource,
  formatLimitWarning,
  formatMessagesOutput,
} from "../../utils/output.js";
import type { MessageDisplayFields } from "../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationLog,
} from "../../utils/pagination.js";

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
    "$ ably channels history my-channel --direction forwards",
  ];

  static override flags = {
    ...productApiFlags,
    cipher: Flags.string({
      description:
        "Decryption key for encrypted messages, uses AES-256 by default",
    }),
    direction: Flags.string({
      default: "backwards",
      description: "Direction of message retrieval",
      options: ["backwards", "forwards"],
    }),

    ...timeRangeFlags,
    limit: Flags.integer({
      default: 50,
      description: "Maximum number of results to return",
      min: 1,
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

      // Show fetching status
      if (this.shouldOutputJson(flags)) {
        this.logJsonEvent(
          {
            channel: channelName,
            limit: flags.limit,
            status: "fetching",
          },
          flags,
        );
      } else {
        this.log(
          formatProgress(
            `Fetching ${flags.limit} most recent messages from channel ${formatResource(channelName)}`,
          ),
        );
      }

      // Build history query parameters
      const historyParams = buildHistoryParams(flags);

      // Get history
      const history = await channel.history(historyParams);
      const {
        items: messages,
        hasMore,
        pagesConsumed,
      } = await collectPaginatedResults(history, flags.limit);

      const paginationWarning = formatPaginationLog(
        pagesConsumed,
        messages.length,
        true,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.log(paginationWarning);
      }

      // Display results based on format
      if (this.shouldOutputJson(flags)) {
        const lastTimestamp =
          messages.length > 0 ? messages.at(-1)!.timestamp : undefined;
        const next = buildPaginationNext(hasMore, lastTimestamp);
        this.logJsonResult({ messages, hasMore, ...(next && { next }) }, flags);
      } else {
        if (messages.length === 0) {
          this.log("No messages found in the channel history.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(messages.length, "message")} in the history of channel: ${formatResource(channelName)}`,
        );
        this.log("");

        const displayMessages: MessageDisplayFields[] = messages.map(
          (message, index) => {
            const ts = message.timestamp ?? Date.now();
            return {
              action:
                message.action === undefined
                  ? undefined
                  : String(message.action),
              channel: channelName,
              clientId: message.clientId,
              data: message.data,
              event: message.name || "(none)",
              id: message.id,
              indexPrefix: `${formatIndex(index + 1)} ${formatTimestamp(formatMessageTimestamp(ts))}`,
              serial: message.serial,
              timestamp: ts,
              version: message.version,
              annotations: message.annotations,
            };
          },
        );

        this.log(formatMessagesOutput(displayMessages));

        if (hasMore) {
          const warning = formatLimitWarning(
            messages.length,
            flags.limit,
            "messages",
          );
          if (warning) this.log(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "channelHistory", {
        channel: channelName,
      });
    }
  }
}
