import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { durationFlag, productApiFlags, rewindFlag } from "../../../flags.js";
import {
  listening,
  success,
  formatTimestamp,
  formatMessageTimestamp,
} from "../../../utils/output.js";

export default class LogsConnectionLifecycleSubscribe extends AblyBaseCommand {
  static override description = "Subscribe to live connection lifecycle logs";

  static override examples = [
    "$ ably logs connection-lifecycle subscribe",
    "$ ably logs connection-lifecycle subscribe --json",
    "$ ably logs connection-lifecycle subscribe --pretty-json",
    "$ ably logs connection-lifecycle subscribe --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...durationFlag,
    ...rewindFlag,
  };

  private client: Ably.Realtime | null = null;
  private cleanupChannelStateLogging: (() => void) | null = null;

  async run(): Promise<void> {
    const { flags } = await this.parse(LogsConnectionLifecycleSubscribe);
    let channel: Ably.RealtimeChannel | null = null;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Get the logs channel with optional rewind
      const logsChannelName = `[meta]connection.lifecycle`;
      const channelOptions: Ably.ChannelOptions = {};
      this.configureRewind(
        channelOptions,
        flags.rewind,
        flags,
        "logs",
        logsChannelName,
      );
      channel = client.channels.get(logsChannelName, channelOptions);

      // Set up channel state logging
      this.cleanupChannelStateLogging = this.setupChannelStateLogging(
        channel,
        flags,
        {
          includeUserFriendlyMessages: true,
        },
      );

      this.logCliEvent(
        flags,
        "logs",
        "subscribing",
        `Subscribing to connection lifecycle logs`,
        { channel: logsChannelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(success("Subscribed to connection lifecycle logs."));
      }

      // Subscribe to connection lifecycle logs
      channel.subscribe((message: Ably.Message) => {
        const timestamp = formatMessageTimestamp(message.timestamp);
        const event = {
          timestamp,
          event: message.name || "connection.lifecycle",
          data: message.data,
          id: message.id,
        };
        this.logCliEvent(
          flags,
          "logs",
          "logReceived",
          `Connection lifecycle log received`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(event, flags));
        } else {
          this.log(
            `${formatTimestamp(timestamp)} ${chalk.cyan(`Event: ${event.event}`)}`,
          );

          if (message.data !== null && message.data !== undefined) {
            this.log(
              `${chalk.dim("Data:")} ${JSON.stringify(message.data, null, 2)}`,
            );
          }

          this.log(""); // Empty line for better readability
        }
      });

      this.logCliEvent(
        flags,
        "logs",
        "listening",
        "Listening for connection lifecycle log events. Press Ctrl+C to exit.",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(listening("Listening for connection lifecycle log events."));
      }

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "logs", flags.duration);
    } catch (error) {
      this.handleCommandError(error, flags, "logs");
    }
  }

  async finally(err: Error | undefined): Promise<void> {
    // Clean up channel state logging event listeners
    if (this.cleanupChannelStateLogging) {
      this.cleanupChannelStateLogging();
      this.cleanupChannelStateLogging = null;
    }

    await super.finally(err);
  }
}
