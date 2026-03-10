import { Args } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatMessageTimestamp,
  formatTimestamp,
  listening,
  progress,
  resource,
  success,
} from "../../../utils/output.js";

export default class ChannelsAnnotationsSubscribe extends AblyBaseCommand {
  static override description = "Subscribe to annotation events on a channel";

  static override examples = [
    "$ ably channels annotations subscribe my-channel",
    "$ ably channels annotations subscribe my-channel --json",
    "$ ably channels annotations subscribe my-channel --duration 30",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels annotations subscribe my-channel',
  ];

  static override args = {
    channel: Args.string({ description: "Channel name", required: true }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsSubscribe);

    try {
      // 1. Create Realtime client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const channelName = args.channel;

      // 2. Get channel with ANNOTATION_SUBSCRIBE mode
      const channel = client.channels.get(channelName, {
        modes: ["ANNOTATION_SUBSCRIBE"],
      });

      // 3. Setup connection & channel state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // 4. Subscribe to annotations
      this.logCliEvent(
        flags,
        "annotations",
        "subscribing",
        `Subscribing to annotation events on channel: ${channelName}`,
        { channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          progress(
            `Subscribing to annotation events on channel: ${resource(channelName)}`,
          ),
        );
      }

      await channel.annotations.subscribe((annotation: Ably.Annotation) => {
        const timestamp = formatMessageTimestamp(annotation.timestamp);
        const event = {
          action: annotation.action,
          channel: channelName,
          clientId: annotation.clientId || null,
          count: annotation.count ?? null,
          data: annotation.data ?? null,
          messageSerial: annotation.messageSerial,
          name: annotation.name || null,
          serial: annotation.serial,
          timestamp,
          type: annotation.type,
        };

        this.logCliEvent(
          flags,
          "annotations",
          annotation.action,
          `Annotation event: ${annotation.action} by ${annotation.clientId || "unknown"}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(event, flags));
        } else {
          this.log(formatTimestamp(timestamp));
          this.log(
            `  ${chalk.dim("Action:")} ${annotation.action === "annotation.create" ? "ANNOTATION.CREATE" : "ANNOTATION.DELETE"}`,
          );
          this.log(`  ${chalk.dim("Type:")} ${annotation.type}`);
          this.log(`  ${chalk.dim("Name:")} ${annotation.name || "(none)"}`);
          this.log(
            `  ${chalk.dim("Client ID:")} ${annotation.clientId ? chalk.blue(annotation.clientId) : "(none)"}`,
          );
          this.log(
            `  ${chalk.dim("Message Serial:")} ${annotation.messageSerial}`,
          );
          this.log(`  ${chalk.dim("Timestamp:")} ${annotation.timestamp}`);
          if (annotation.data) {
            this.log(
              `  ${chalk.dim("Data:")} ${JSON.stringify(annotation.data)}`,
            );
          }
          this.log(""); // Empty line for readability
        }
      });

      // 5. Show success message
      if (!this.shouldOutputJson(flags)) {
        this.log(
          success(
            `Subscribed to annotations on channel: ${resource(channelName)}.`,
          ),
        );
        this.log(listening("Listening for annotation events."));
        this.log("");
      }

      this.logCliEvent(
        flags,
        "annotations",
        "listening",
        "Listening for annotation events. Press Ctrl+C to exit.",
      );

      // 6. Wait until interrupted or timeout, then cleanup
      await this.waitAndTrackCleanup(flags, "annotations", flags.duration);
    } catch (error) {
      this.handleCommandError(error, flags, "annotations:subscribe", {
        channel: args.channel,
      });
    }
  }
}
