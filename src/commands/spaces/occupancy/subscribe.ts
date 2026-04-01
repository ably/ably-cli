import { Args } from "@oclif/core";
import * as Ably from "ably";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
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

const SPACE_CHANNEL_TAG = "::$space";

export default class SpacesOccupancySubscribe extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Space name to subscribe to occupancy events",
      required: true,
    }),
  };

  static override description = "Subscribe to occupancy events on a space";

  static override examples = [
    "$ ably spaces occupancy subscribe my-space",
    "$ ably spaces occupancy subscribe my-space --json",
    "$ ably spaces occupancy subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesOccupancySubscribe);
    let channel: Ably.RealtimeChannel | null = null;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const spaceName = args.space_name;
      const channelName = `${spaceName}${SPACE_CHANNEL_TAG}`;
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
        "spacesOccupancy",
        "subscribing",
        `Subscribing to occupancy events on space: ${spaceName}`,
        { spaceName, channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Subscribing to occupancy events on space: ${formatResource(spaceName)}`,
          ),
        );
      }

      await channel.subscribe(occupancyEventName, (message: Ably.Message) => {
        const timestamp = formatMessageTimestamp(message.timestamp);

        // Only expose connections and presenceMembers
        const rawData =
          (message.data as Record<string, unknown> | undefined) ?? {};
        const rawMetrics = rawData.metrics as
          | Record<string, number>
          | undefined;
        const filteredData: Record<string, unknown> = { ...rawData };
        if (rawMetrics) {
          filteredData.metrics = {
            connections: rawMetrics.connections,
            presenceMembers: rawMetrics.presenceMembers,
          };
        }

        const event = {
          spaceName,
          event: occupancyEventName,
          data: filteredData,
          timestamp,
        };

        this.logCliEvent(
          flags,
          "spacesOccupancy",
          "occupancyUpdate",
          `Occupancy update received for space ${spaceName}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ occupancy: event }, flags);
        } else {
          this.log(formatTimestamp(timestamp));
          this.log(`${formatLabel("Space")} ${formatResource(spaceName)}`);
          this.log(
            `${formatLabel("Event")} ${formatEventType("Occupancy Update")}`,
          );

          const metrics = filteredData.metrics as
            | Record<string, number>
            | undefined;
          if (metrics) {
            this.log(`${formatLabel("Connections")} ${metrics.connections}`);
            this.log(
              `${formatLabel("Presence Members")} ${metrics.presenceMembers}`,
            );
          }

          this.log("");
        }
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(
            `Subscribed to occupancy on space: ${formatResource(spaceName)}.`,
          ),
        );
        this.log(formatListening("Listening for occupancy events."));
      }

      this.logCliEvent(
        flags,
        "spacesOccupancy",
        "listening",
        "Listening for occupancy events. Press Ctrl+C to exit.",
      );

      await this.waitAndTrackCleanup(flags, "spacesOccupancy", flags.duration);
    } catch (error) {
      this.fail(error, flags, "spacesOccupancySubscribe", {
        spaceName: args.space_name,
      });
    }
  }
}
