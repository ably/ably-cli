import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import { JsonStatusType } from "../../../utils/json-status.js";
import {
  formatClientId,
  formatLabel,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class ChannelsPresenceUpdate extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel to update presence on",
      required: true,
    }),
  };

  static override description = "Update presence data on a channel";

  static override examples = [
    '$ ably channels presence update my-channel --data \'{"status":"away"}\'',
    '$ ably channels presence update my-channel --data \'{"status":"busy"}\' --json',
    '$ ably channels presence update my-channel --data \'{"status":"busy"}\' --pretty-json',
    '$ ably channels presence update my-channel --data \'{"status":"online"}\' --duration 60',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    data: Flags.string({
      description: "JSON data to associate with the presence update",
      required: true,
    }),
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPresenceUpdate);

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const { channel: channelName } = args;

      const data = this.parseJsonFlag(flags.data, "data", flags);

      this.channel = client.channels.get(channelName);

      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });
      this.setupChannelStateLogging(this.channel, flags, {
        includeUserFriendlyMessages: true,
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Entering and updating presence on channel: ${formatResource(channelName)}`,
          ),
        );
      }

      // Enter first (required before update)
      this.logCliEvent(
        flags,
        "presence",
        "entering",
        `Entering presence on channel ${channelName}`,
        { channel: channelName, clientId: client.auth.clientId },
      );
      await this.channel.presence.enter(data);
      this.logCliEvent(
        flags,
        "presence",
        "entered",
        `Entered presence on channel ${channelName}`,
        { channel: channelName, clientId: client.auth.clientId },
      );

      // Update presence data
      this.logCliEvent(
        flags,
        "presence",
        "updating",
        `Updating presence data on channel ${channelName}`,
        { channel: channelName, data },
      );
      await this.channel.presence.update(data);
      this.logCliEvent(
        flags,
        "presence",
        "updated",
        `Updated presence data on channel ${channelName}`,
        { channel: channelName, clientId: client.auth.clientId, data },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            presenceMessage: {
              action: "update",
              channel: channelName,
              clientId: client.auth.clientId,
              connectionId: client.connection.id,
              data,
              timestamp: new Date().toISOString(),
            },
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Updated presence on channel: ${formatResource(channelName)}.`,
          ),
        );
        this.log(
          `${formatLabel("Client ID")} ${formatClientId(client.auth.clientId)}`,
        );
        this.log(`${formatLabel("Connection ID")} ${client.connection.id}`);
        this.log(`${formatLabel("Data")} ${JSON.stringify(data)}`);
        this.log(formatListening("Holding presence."));
      }

      this.logJsonStatus(
        JsonStatusType.Holding,
        "Holding presence. Press Ctrl+C to exit.",
        flags,
      );

      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "presenceUpdate", {
        channel: args.channel,
      });
    }
  }

  async finally(err: Error | undefined): Promise<void> {
    if (this.channel && this.client) {
      try {
        await Promise.race([
          this.channel.presence.leave(),
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch {
        // Ignore cleanup errors
      }
    }

    await super.finally(err);
  }
}
