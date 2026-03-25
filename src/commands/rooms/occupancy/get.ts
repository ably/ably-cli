import { Args } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

const CHAT_CHANNEL_TAG = "::$chat";

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

export default class RoomsOccupancyGet extends AblyBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to get occupancy for",
      required: true,
    }),
  };

  static override description = "Get current occupancy metrics for a room";

  static override examples = [
    "$ ably rooms occupancy get my-room",
    "$ ably rooms occupancy get my-room --json",
    "$ ably rooms occupancy get my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsOccupancyGet);

    try {
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      const roomName = args.room;
      const channelName = `${roomName}${CHAT_CHANNEL_TAG}`;

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
        objectPublishers: 0,
        objectSubscribers: 0,
      };

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            occupancy: {
              roomName,
              metrics: occupancyMetrics,
            },
          },
          flags,
        );
      } else {
        this.log(`Occupancy metrics for room ${formatResource(roomName)}:\n`);
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
      this.fail(error, flags, "roomOccupancyGet", { room: args.room });
    }
  }
}
