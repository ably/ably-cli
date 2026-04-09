import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../../flags.js";
import {
  formatEventType,
  formatMessageTimestamp,
  formatTimestamp,
  formatLabel,
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
    ...clientIdFlag,
    ...durationFlag,
    ...rewindFlag,
  };

  private client: Ably.Realtime | null = null;
  private cleanupChannelStateLogging: (() => void) | null = null;

  async run(): Promise<void> {
    const { flags } = await this.parse(LogsConnectionLifecycleSubscribe);
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
      const channel = client.channels.get(logsChannelName, channelOptions);

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

      // Subscribe to connection lifecycle logs
      await channel.subscribe((message: Ably.Message) => {
        const timestamp = formatMessageTimestamp(message.timestamp);
        const event = {
          timestamp,
          event: message.name || "connection.lifecycle",
          data: message.data as unknown,
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
          this.logJsonEvent({ log: event }, flags);
        } else {
          this.log(
            `${formatTimestamp(timestamp)} Event: ${formatEventType(event.event)}`,
          );

          if (message.data !== null && message.data !== undefined) {
            this.log(
              `${formatLabel("Data")} ${JSON.stringify(message.data, null, 2)}`,
            );
          }

          this.log(""); // Empty line for better readability
        }
      });

      this.logSuccessMessage("Subscribed to connection lifecycle logs.", flags);

      this.logCliEvent(
        flags,
        "logs",
        "listening",
        "Listening for connection lifecycle log events. Press Ctrl+C to exit.",
      );
      this.logListening(
        "Listening for connection lifecycle log events.",
        flags,
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "logs", flags.duration);
    } catch (error) {
      this.fail(error, flags, "connectionLifecycleSubscribe");
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
