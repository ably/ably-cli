import { Args } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { CommandError } from "../../../errors/command-error.js";
import { productApiFlags } from "../../../flags.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

interface OccupancyMetrics {
  connections: number;
  presenceConnections: number;
  presenceMembers: number;
  presenceSubscribers: number;
  publishers: number;
  subscribers: number;
  objectPublishers: number;
  objectSubscribers: number;
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

      if (channelDetails.statusCode !== 200) {
        this.fail(
          CommandError.fromHttpResponse(
            channelDetails,
            "Failed to get channel occupancy",
          ),
          flags,
          "occupancyGet",
          { channel: channelName },
        );
      }

      const occupancyData = channelDetails.items?.[0] || {};
      const occupancyMetrics: OccupancyMetrics = occupancyData.status?.occupancy
        ?.metrics || {
        connections: 0,
        presenceConnections: 0,
        presenceMembers: 0,
        presenceSubscribers: 0,
        publishers: 0,
        subscribers: 0,
        objectPublishers: 0,
        objectSubscribers: 0,
      };

      // Output the occupancy metrics based on format
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            occupancy: {
              channel: channelName,
              metrics: occupancyMetrics,
            },
          },
          flags,
        );
      } else {
        this.log(
          `Occupancy metrics for channel ${formatResource(channelName)}:\n`,
        );
        this.log(
          `${formatLabel("Connections")} ${occupancyMetrics.connections}`,
        );
        this.log(`${formatLabel("Publishers")} ${occupancyMetrics.publishers}`);
        this.log(
          `${formatLabel("Subscribers")} ${occupancyMetrics.subscribers}`,
        );
        this.log(
          `${formatLabel("Presence Connections")} ${occupancyMetrics.presenceConnections}`,
        );
        this.log(
          `${formatLabel("Presence Members")} ${occupancyMetrics.presenceMembers}`,
        );
        this.log(
          `${formatLabel("Presence Subscribers")} ${occupancyMetrics.presenceSubscribers}`,
        );
        this.log(
          `${formatLabel("Object Publishers")} ${occupancyMetrics.objectPublishers}`,
        );
        this.log(
          `${formatLabel("Object Subscribers")} ${occupancyMetrics.objectSubscribers}`,
        );
      }
    } catch (error) {
      this.fail(error, flags, "occupancyGet", {
        channel: args.channel,
      });
    }
  }
}
