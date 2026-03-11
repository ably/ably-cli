import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../../flags.js";
import { formatMessageData } from "../../../utils/json-formatter.js";
import {
  formatListening,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatMessageTimestamp,
} from "../../../utils/output.js";

export default class LogsPushSubscribe extends AblyBaseCommand {
  static override description =
    "Stream logs from the push notifications meta channel [meta]log:push";

  static override examples = [
    "$ ably logs push subscribe",
    "$ ably logs push subscribe --rewind 10",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
    ...rewindFlag,
  };

  private client: Ably.Realtime | null = null;

  // Override finally to ensure resources are cleaned up

  async run(): Promise<void> {
    const { flags } = await this.parse(LogsPushSubscribe);

    try {
      // Create the Ably client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const { client } = this; // local const
      const channelName = "[meta]log:push";
      const channelOptions: Ably.ChannelOptions = {};

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Configure rewind if specified
      this.configureRewind(
        channelOptions,
        flags.rewind,
        flags,
        "logs",
        channelName,
      );

      const channel = client.channels.get(channelName, channelOptions);

      // Set up channel state logging
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      this.logCliEvent(
        flags,
        "logs",
        "subscribing",
        `Subscribing to ${channelName}...`,
      );

      // Subscribe to the channel
      channel.subscribe((message) => {
        const timestamp = formatMessageTimestamp(message.timestamp);
        const event = message.name || "unknown";
        const logEvent = {
          channel: channelName,
          data: message.data,
          event,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "logs",
          "logReceived",
          `Log received on ${channelName}`,
          logEvent,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(logEvent, flags);
          return;
        }

        // Color-code different event types based on severity
        let eventColor = chalk.blue;

        // For push log events - based on examples and severity
        if (
          message.data &&
          typeof message.data === "object" &&
          "severity" in message.data
        ) {
          const severity = message.data.severity as string;
          switch (severity) {
            case "error": {
              eventColor = chalk.red;

              break;
            }

            case "warning": {
              eventColor = chalk.yellow;

              break;
            }

            case "info": {
              eventColor = chalk.green;

              break;
            }

            case "debug": {
              eventColor = chalk.blue;

              break;
            }
            // No default
          }
        }

        // Format the log output
        this.log(
          `${formatTimestamp(timestamp)} Channel: ${formatResource(channelName)} | Event: ${eventColor(event)}`,
        );
        if (message.data) {
          this.log("Data:");
          this.log(formatMessageData(message.data));
        }

        this.log("");
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(`Subscribed to ${formatResource(channelName)}.`),
        );
        this.log(formatListening("Listening for push logs."));
        this.log("");
      }

      this.logCliEvent(
        flags,
        "logs",
        "subscribed",
        `Subscribed to ${channelName}`,
      );

      this.logCliEvent(flags, "logs", "listening", "Listening for logs...");

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "logs", flags.duration);
    } catch (error: unknown) {
      this.fail(error, flags, "PushLogSubscribe");
    }
    // Client cleanup is handled by command finally() method
  }
}
