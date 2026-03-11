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
  formatClientId,
  formatEventType,
} from "../../../utils/output.js";

export default class ChannelsPresenceSubscribe extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to subscribe to presence events",
      required: true,
    }),
  };

  static override description = "Subscribe to presence events on a channel";

  static override examples = [
    "$ ably channels presence subscribe my-channel",
    '$ ably channels presence subscribe my-channel --client-id "filter123"',
    "$ ably channels presence subscribe my-channel --json",
    "$ ably channels presence subscribe my-channel --pretty-json",
    "$ ably channels presence subscribe my-channel --duration 30",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels presence subscribe my-channel',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPresenceSubscribe);
    let channel: Ably.RealtimeChannel | null = null;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const channelName = args.channel;

      channel = client.channels.get(channelName);

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Set up channel state logging
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to presence events
      this.logCliEvent(
        flags,
        "presence",
        "subscribing",
        `Subscribing to presence events on channel: ${channelName}`,
        { channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Subscribing to presence events on channel: ${formatResource(channelName)}`,
          ),
        );
      }

      channel.presence.subscribe((presenceMessage: Ably.PresenceMessage) => {
        const timestamp = formatMessageTimestamp(presenceMessage.timestamp);
        const event = {
          action: presenceMessage.action,
          channel: channelName,
          clientId: presenceMessage.clientId,
          connectionId: presenceMessage.connectionId,
          data: presenceMessage.data,
          id: presenceMessage.id,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "presence",
          presenceMessage.action!,
          `Presence event: ${presenceMessage.action} by ${presenceMessage.clientId}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(event, flags);
        } else {
          const action = presenceMessage.action || "unknown";
          const clientId = presenceMessage.clientId || "Unknown";

          this.log(
            `${formatTimestamp(timestamp)} ${formatResource(`Channel: ${channelName}`)} | Action: ${formatEventType(action)} | Client: ${formatClientId(clientId)}`,
          );

          if (
            presenceMessage.data !== null &&
            presenceMessage.data !== undefined
          ) {
            this.log(
              `${formatLabel("Data")} ${JSON.stringify(presenceMessage.data, null, 2)}`,
            );
          }

          this.log(""); // Empty line for better readability
        }
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(
            `Subscribed to presence on channel: ${formatResource(channelName)}.`,
          ),
        );
        this.log(formatListening("Listening for presence events."));
      }

      this.logCliEvent(
        flags,
        "presence",
        "listening",
        "Listening for presence events. Press Ctrl+C to exit.",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "presenceSubscribe", {
        channel: args.channel,
      });
    }
  }
}
