import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags } from "../../flags.js";
import { errorMessage } from "../../utils/errors.js";
import {
  formatCountLabel,
  formatLabel,
  formatLimitWarning,
  formatResource,
} from "../../utils/output.js";

interface ChannelMetrics {
  connections?: number;
  presenceConnections?: number;
  presenceMembers?: number;
  publishers?: number;
  subscribers?: number;
}

interface ChannelStatus {
  occupancy?: {
    metrics?: ChannelMetrics;
  };
}

interface ChannelItem {
  channelId: string;
  status?: ChannelStatus;
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
      description: "Maximum number of results to return (default: 100)",
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
        this.error(`Failed to list channels: ${channelsResponse.statusCode}`);
        return;
      }

      const channels = channelsResponse.items || [];

      // Output channels based on format
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              channels: channels.map((channel: ChannelItem) => ({
                channelId: channel.channelId,
                metrics: channel.status?.occupancy?.metrics || {},
              })),
              hasMore: channels.length === flags.limit,
              success: true,
              timestamp: new Date().toISOString(),
              total: channels.length,
            },
            flags,
          ),
        );
      } else {
        if (channels.length === 0) {
          this.log("No active channels found.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(channels.length, "active channel")}:`,
        );

        for (const channel of channels as ChannelItem[]) {
          this.log(`${formatResource(channel.channelId)}`);

          // Show occupancy if available
          if (channel.status?.occupancy?.metrics) {
            const { metrics } = channel.status.occupancy;
            this.log(
              `  ${formatLabel("Connections")} ${metrics.connections || 0}`,
            );
            this.log(
              `  ${formatLabel("Publishers")} ${metrics.publishers || 0}`,
            );
            this.log(
              `  ${formatLabel("Subscribers")} ${metrics.subscribers || 0}`,
            );

            if (metrics.presenceConnections !== undefined) {
              this.log(
                `  ${formatLabel("Presence Connections")} ${metrics.presenceConnections}`,
              );
            }

            if (metrics.presenceMembers !== undefined) {
              this.log(
                `  ${formatLabel("Presence Members")} ${metrics.presenceMembers}`,
              );
            }
          }

          this.log(""); // Add a line break between channels
        }

        const warning = formatLimitWarning(
          channels.length,
          flags.limit,
          "channels",
        );
        if (warning) this.log(warning);
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: errorMessage(error),
            status: "error",
            success: false,
          },
          flags,
        );
        return;
      } else {
        this.error(`Error listing channels: ${errorMessage(error)}`);
      }
    }
  }
}
