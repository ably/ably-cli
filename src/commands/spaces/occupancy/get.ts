import { Args } from "@oclif/core";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { productApiFlags } from "../../../flags.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

const SPACE_CHANNEL_TAG = "::$space";

interface OccupancyMetrics {
  connections: number;
  presenceMembers: number;
}

export default class SpacesOccupancyGet extends SpacesBaseCommand {
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

      const occupancyData = (channelDetails.items[0] ?? {}) as Record<
        string,
        unknown
      >;
      const status = occupancyData.status as
        | Record<string, unknown>
        | undefined;
      const occupancy = status?.occupancy as
        | Record<string, unknown>
        | undefined;
      const raw = (occupancy?.metrics ?? {}) as Record<string, number>;
      const occupancyMetrics: OccupancyMetrics = {
        connections: raw.connections ?? 0,
        presenceMembers: raw.presenceMembers ?? 0,
      };

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            occupancy: {
              spaceName,
              metrics: occupancyMetrics,
            },
          },
          flags,
        );
      } else {
        this.log(`Occupancy metrics for space ${formatResource(spaceName)}:\n`);
        this.log(
          `${formatLabel("Connections")} ${occupancyMetrics.connections}`,
        );
        this.log(
          `${formatLabel("Presence Members")} ${occupancyMetrics.presenceMembers}`,
        );
      }
    } catch (error) {
      this.fail(error, flags, "spacesOccupancyGet", {
        spaceName: args.space_name,
      });
    }
  }
}
