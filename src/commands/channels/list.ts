import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../base-command.js";
import { CommandError } from "../../errors/command-error.js";
import { productApiFlags } from "../../flags.js";
import {
  formatCountLabel,
  formatLimitWarning,
  formatResource,
} from "../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationLog,
} from "../../utils/pagination.js";

interface ChannelItem {
  channelId: string;
  [key: string]: unknown;
}

// Type for channel listing request parameters
interface ChannelListParams {
  limit: number;
  prefix?: string;
}

export default class ChannelsList extends AblyBaseCommand {
  static override description =
    "List active channels using the channel enumeration API";

  static override examples = [
    "$ ably channels list",
    "$ ably channels list --prefix my-channel",
    "$ ably channels list --limit 50",
    "$ ably channels list --json",
    "$ ably channels list --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return",
      min: 1,
    }),
    prefix: Flags.string({
      char: "p",
      description: "Filter channels by prefix",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ChannelsList);

    try {
      // REST client for channel enumeration
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build params for channel listing
      const params: ChannelListParams = {
        limit: flags.limit,
      };

      if (flags.prefix) {
        params.prefix = flags.prefix;
      }

      // Fetch channels
      const channelsResponse = await rest.request(
        "get",
        "/channels",
        2,
        params,
        null,
      );

      if (channelsResponse.statusCode !== 200) {
        this.fail(
          CommandError.fromHttpResponse(
            channelsResponse,
            "Failed to list channels",
          ),
          flags,
          "channelList",
        );
      }

      const {
        items: channels,
        hasMore,
        pagesConsumed,
      } = await collectPaginatedResults<ChannelItem>(
        channelsResponse,
        flags.limit,
      );

      const paginationWarning = formatPaginationLog(
        pagesConsumed,
        channels.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.logToStderr(paginationWarning);
      }

      // Output channels based on format
      if (this.shouldOutputJson(flags)) {
        const next = buildPaginationNext(hasMore);
        this.logJsonResult(
          {
            channels: channels.map((channel: ChannelItem) => channel.channelId),
            hasMore,
            ...(next && { next }),
            timestamp: new Date().toISOString(),
            total: channels.length,
          },
          flags,
        );
      } else {
        if (channels.length === 0) {
          this.log("No active channels found.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(channels.length, "active channel")}:\n`,
        );

        for (const channel of channels) {
          this.log(`${formatResource(channel.channelId)}`);
        }

        if (hasMore) {
          const warning = formatLimitWarning(
            channels.length,
            flags.limit,
            "channels",
          );
          if (warning) this.logToStderr(`\n${warning}`);
        }
      }
    } catch (error) {
      this.fail(error, flags, "channelList");
    }
  }
}
