import { Args } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { errorMessage } from "../../../utils/errors.js";
import { formatResource } from "../../../utils/output.js";

interface OccupancyMetrics {
  connections: number;
  presenceConnections: number;
  presenceMembers: number;
  presenceSubscribers: number;
  publishers: number;
  subscribers: number;
}

export default class ChannelsOccupancyGet extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to get occupancy for",
      required: true,
    }),
  };

  static override description = "Get current occupancy metrics for a channel";

  static override examples = [
    "$ ably channels occupancy get my-channel",
    "$ ably channels occupancy get my-channel --json",
    "$ ably channels occupancy get my-channel --pretty-json",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels occupancy get my-channel',
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsOccupancyGet);

    try {
      // Create the Ably REST client
      const client = await this.createAblyRestClient(flags);
      if (!client) {
        return;
      }

      const channelName = args.channel;

      // Use the REST API to get channel details with occupancy
      const channelDetails = await client.request(
        "get",
        `/channels/${encodeURIComponent(channelName)}`,
        2, // version
        { occupancy: "metrics" }, // params
        null, // body
      );

      const occupancyData = channelDetails.items?.[0] || {};
      const occupancyMetrics: OccupancyMetrics = occupancyData.status?.occupancy
        ?.metrics || {
        connections: 0,
        presenceConnections: 0,
        presenceMembers: 0,
        presenceSubscribers: 0,
        publishers: 0,
        subscribers: 0,
      };

      // Output the occupancy metrics based on format
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              channel: channelName,
              metrics: occupancyMetrics,
              success: true,
            },
            flags,
          ),
        );
      } else {
        this.log(
          `Occupancy metrics for channel ${formatResource(channelName)}:\n`,
        );
        this.log(
          `${chalk.dim("Connections:")} ${occupancyMetrics.connections ?? 0}`,
        );
        this.log(
          `${chalk.dim("Publishers:")} ${occupancyMetrics.publishers ?? 0}`,
        );
        this.log(
          `${chalk.dim("Subscribers:")} ${occupancyMetrics.subscribers ?? 0}`,
        );

        if (occupancyMetrics.presenceConnections !== undefined) {
          this.log(
            `${chalk.dim("Presence Connections:")} ${occupancyMetrics.presenceConnections}`,
          );
        }

        if (occupancyMetrics.presenceMembers !== undefined) {
          this.log(
            `${chalk.dim("Presence Members:")} ${occupancyMetrics.presenceMembers}`,
          );
        }

        if (occupancyMetrics.presenceSubscribers !== undefined) {
          this.log(
            `${chalk.dim("Presence Subscribers:")} ${occupancyMetrics.presenceSubscribers}`,
          );
        }
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            channel: args.channel,
            error: errorMessage(error),
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error fetching channel occupancy: ${errorMessage(error)}`);
      }
    }
  }
}
