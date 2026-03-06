import { Args } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { durationFlag, productApiFlags } from "../../../flags.js";
import {
  listening,
  progress,
  resource,
  success,
  formatTimestamp,
  formatMessageTimestamp,
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
          progress(
            `Subscribing to occupancy events on channel: ${resource(channelName)}`,
          ),
        );
      }

      channel.subscribe(occupancyEventName, (message: Ably.Message) => {
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
          this.log(this.formatJsonOutput(event, flags));
        } else {
          this.log(
            `${formatTimestamp(timestamp)} ${chalk.cyan(`Channel: ${channelName}`)} | ${chalk.yellow("Occupancy Update")}`,
          );

          if (message.data !== null && message.data !== undefined) {
            this.log(
              `${chalk.dim("Occupancy Data:")} ${JSON.stringify(message.data, null, 2)}`,
            );
          }

          this.log(""); // Empty line for better readability
        }
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          success(
            `Subscribed to occupancy on channel: ${resource(channelName)}.`,
          ),
        );
        this.log(listening("Listening for occupancy events."));
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
      this.handleCommandError(error, flags, "occupancy", {
        channel: args.channel,
      });
    }
  }
}
