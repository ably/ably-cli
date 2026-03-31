import { Args } from "@oclif/core";
import * as Ably from "ably";
import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatMessageTimestamp,
  formatLabel,
  formatEventType,
} from "../../../utils/output.js";

export default class ChannelsOccupancySubscribe extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to subscribe to occupancy events",
      required: true,
    }),
  };

  static override description = "Subscribe to occupancy events on a channel";

  static override examples = [
    "$ ably channels occupancy subscribe my-channel",
    "$ ably channels occupancy subscribe my-channel --json",
    "$ ably channels occupancy subscribe my-channel --pretty-json",
    "$ ably channels occupancy subscribe my-channel --duration 30",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels occupancy subscribe my-channel',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsOccupancySubscribe);
    let channel: Ably.RealtimeChannel | null = null;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const channelName = args.channel;

      // Get channel with occupancy option enabled
      channel = client.channels.get(channelName, {
        params: {
          occupancy: "metrics",
        },
      });

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Set up channel state logging
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to occupancy events - these are delivered as channel events
      // According to docs, occupancy updates come as [meta]occupancy events
      const occupancyEventName = "[meta]occupancy";
      this.logCliEvent(
        flags,
        "occupancy",
        "subscribing",
        `Subscribing to occupancy events on channel: ${channelName}`,
        { channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Subscribing to occupancy events on channel: ${formatResource(channelName)}`,
          ),
        );
      }

      await channel.subscribe(occupancyEventName, (message: Ably.Message) => {
        const timestamp = formatMessageTimestamp(message.timestamp);
        const event = {
          channel: channelName,
          event: occupancyEventName,
          data: message.data,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "occupancy",
          "occupancyUpdate",
          `Occupancy update received for channel ${channelName}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ occupancy: event }, flags);
        } else {
          this.log(formatTimestamp(timestamp));
          this.log(`${formatLabel("Channel")} ${formatResource(channelName)}`);
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
            `Subscribed to occupancy on channel: ${formatResource(channelName)}.`,
          ),
        );
        this.log(formatListening("Listening for occupancy events."));
      }

      this.logCliEvent(
        flags,
        "occupancy",
        "listening",
        "Listening for occupancy events. Press Ctrl+C to exit.",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "occupancy", flags.duration);
    } catch (error) {
      this.fail(error, flags, "occupancySubscribe", {
        channel: args.channel,
      });
    }
  }
}
