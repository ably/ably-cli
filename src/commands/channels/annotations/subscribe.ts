import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";
import {
  formatTimestamp,
  listening,
  progress,
  resource,
  success,
} from "../../../utils/output.js";

export default class ChannelsAnnotationsSubscribe extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to subscribe to annotation events",
      required: true,
    }),
  };

  static override description = "Subscribe to annotation events on a channel";

  static override examples = [
    "$ ably channels annotations subscribe my-channel",
    "$ ably channels annotations subscribe my-channel --json",
    "$ ably channels annotations subscribe my-channel --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    duration: Flags.integer({
      description: "Automatically exit after N seconds",
      char: "D",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsSubscribe);

    try {
      // 1. Create Realtime client
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      // 2. Get channel with ANNOTATION_SUBSCRIBE mode
      const channel = client.channels.get(args.channel, {
        modes: ["ANNOTATION_SUBSCRIBE"],
      });

      // 3. Setup connection & channel state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(progress(`Attaching to channel: ${resource(args.channel)}`));
      }

      // 4. Subscribe to annotations
      await channel.annotations.subscribe((annotation: Ably.Annotation) => {
        const timestamp = annotation.timestamp
          ? new Date(annotation.timestamp).toISOString()
          : new Date().toISOString();

        const event = {
          action: annotation.action,
          channel: args.channel,
          clientId: annotation.clientId || null,
          count: annotation.count ?? null,
          data: annotation.data ?? null,
          messageSerial: annotation.messageSerial,
          name: annotation.name || null,
          serial: annotation.serial,
          timestamp,
          type: annotation.type,
        };

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(event, flags));
        } else {
          const actionLabel =
            annotation.action === "annotation.create"
              ? chalk.green("CREATE")
              : chalk.red("DELETE");
          this.log(
            `${formatTimestamp(timestamp)} ${actionLabel} | ${chalk.dim("Type:")} ${annotation.type} | ${chalk.dim("Name:")} ${annotation.name || "(none)"} | ${chalk.dim("Client:")} ${annotation.clientId ? chalk.blue(annotation.clientId) : "(none)"}`,
          );
          if (annotation.data) {
            this.log(
              `  ${chalk.dim("Data:")} ${JSON.stringify(annotation.data)}`,
            );
          }

          this.log("");
        }
      });

      // 5. Show success message
      if (!this.shouldOutputJson(flags)) {
        this.log(
          success(
            `Subscribed to annotations on channel ${resource(args.channel)}.`,
          ),
        );
        this.log(listening("Listening for annotation events."));
      }

      this.logCliEvent(
        flags,
        "annotations",
        "listening",
        "Listening for annotation events. Press Ctrl+C to exit.",
      );

      // 6. Wait until interrupted or timeout
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);

      // 7. Auto-unsubscribe on cleanup
      channel.annotations.unsubscribe();
      this.logCliEvent(
        flags,
        "annotations:subscribe",
        "cleanup",
        "Unsubscribed from annotations",
        { exitReason },
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(`Error: ${errorMsg}`);
      }
    }
  }
}
