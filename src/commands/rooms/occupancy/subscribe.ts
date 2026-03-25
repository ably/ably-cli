import { Args } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatEventType,
  formatLabel,
  formatListening,
  formatMessageTimestamp,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
} from "../../../utils/output.js";

const CHAT_CHANNEL_TAG = "::$chat";

export default class RoomsOccupancySubscribe extends AblyBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to subscribe to occupancy events",
      required: true,
    }),
  };

  static override description = "Subscribe to occupancy events on a room";

  static override examples = [
    "$ ably rooms occupancy subscribe my-room",
    "$ ably rooms occupancy subscribe my-room --json",
    "$ ably rooms occupancy subscribe my-room --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsOccupancySubscribe);
    let channel: Ably.RealtimeChannel | null = null;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const roomName = args.room;
      const channelName = `${roomName}${CHAT_CHANNEL_TAG}`;
      const occupancyEventName = "[meta]occupancy";

      // Get channel with occupancy metrics enabled
      channel = this.client.channels.get(channelName, {
        params: { occupancy: "metrics" },
      });

      // Set up connection and channel state logging
      this.setupConnectionStateLogging(this.client, flags, {
        includeUserFriendlyMessages: true,
      });
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      this.logCliEvent(
        flags,
        "roomOccupancy",
        "subscribing",
        `Subscribing to occupancy events on room: ${roomName}`,
        { roomName, channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Subscribing to occupancy events on room: ${formatResource(roomName)}`,
          ),
        );
      }

      await channel.subscribe(occupancyEventName, (message: Ably.Message) => {
        const timestamp = formatMessageTimestamp(message.timestamp);
        const event = {
          roomName,
          event: occupancyEventName,
          data: message.data,
          timestamp,
        };

        this.logCliEvent(
          flags,
          "roomOccupancy",
          "occupancyUpdate",
          `Occupancy update received for room ${roomName}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ occupancy: event }, flags);
        } else {
          this.log(formatTimestamp(timestamp));
          this.log(`${formatLabel("Room")} ${formatResource(roomName)}`);
          this.log(
            `${formatLabel("Event")} ${formatEventType("Occupancy Update")}`,
          );

          if (message.data?.metrics) {
            const metrics = message.data.metrics;
            this.log(`${formatLabel("Connections")} ${metrics.connections}`);
            this.log(`${formatLabel("Publishers")} ${metrics.publishers}`);
            this.log(`${formatLabel("Subscribers")} ${metrics.subscribers}`);
            this.log(
              `${formatLabel("Presence Connections")} ${metrics.presenceConnections}`,
            );
            this.log(
              `${formatLabel("Presence Members")} ${metrics.presenceMembers}`,
            );
            this.log(
              `${formatLabel("Presence Subscribers")} ${metrics.presenceSubscribers}`,
            );
            this.log(
              `${formatLabel("Object Publishers")} ${metrics.objectPublishers}`,
            );
            this.log(
              `${formatLabel("Object Subscribers")} ${metrics.objectSubscribers}`,
            );
          }

          this.log("");
        }
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(
            `Subscribed to occupancy on room: ${formatResource(roomName)}.`,
          ),
        );
        this.log(formatListening("Listening for occupancy events."));
      }

      this.logCliEvent(
        flags,
        "roomOccupancy",
        "listening",
        "Listening for occupancy events. Press Ctrl+C to exit.",
      );

      await this.waitAndTrackCleanup(flags, "roomOccupancy", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomOccupancySubscribe", {
        room: args.room,
      });
    }
  }
}
