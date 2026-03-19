import { Args } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

const SPACE_CHANNEL_TAG = "::$space";

interface OccupancyMetrics {
  connections: number;
  presenceConnections: number;
  presenceMembers: number;
  presenceSubscribers: number;
  publishers: number;
  subscribers: number;
}

export default class SpacesOccupancyGet extends AblyBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Space name to get occupancy for",
      required: true,
    }),
  };

  static override description = "Get current occupancy metrics for a space";

  static override examples = [
    "$ ably spaces occupancy get my-space",
    "$ ably spaces occupancy get my-space --json",
    "$ ably spaces occupancy get my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesOccupancyGet);

    try {
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      const spaceName = args.space_name;
      const channelName = `${spaceName}${SPACE_CHANNEL_TAG}`;

      const channelDetails = await client.request(
        "get",
        `/channels/${encodeURIComponent(channelName)}`,
        2,
        { occupancy: "metrics" },
        null,
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

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            spaceName,
            metrics: occupancyMetrics,
          },
          flags,
        );
      } else {
        this.log(`Occupancy metrics for space ${formatResource(spaceName)}:\n`);
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
      }
    } catch (error) {
      this.fail(error, flags, "spacesOccupancyGet", {
        spaceName: args.space_name,
      });
    }
  }
}
