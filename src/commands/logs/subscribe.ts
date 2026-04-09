import { Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../flags.js";
import {
  formatEventType,
  formatMessageTimestamp,
  formatResource,
  formatTimestamp,
  formatLabel,
} from "../../utils/output.js";

export default class LogsSubscribe extends AblyBaseCommand {
  static override description = "Subscribe to live app logs";

  static override examples = [
    "$ ably logs subscribe",
    "$ ably logs subscribe --rewind 10",
    "$ ably logs subscribe --type channel.lifecycle",
    "$ ably logs subscribe --json",
    "$ ably logs subscribe --pretty-json",
    "$ ably logs subscribe --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
    ...rewindFlag,
    type: Flags.string({
      description: "Filter by log type",
      options: [
        "channel.lifecycle",
        "channel.occupancy",
        "channel.presence",
        "connection.lifecycle",
        "push.publish",
      ],
    }),
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { flags } = await this.parse(LogsSubscribe);
    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Get the logs channel
      const appConfig = await this.ensureAppAndKey(flags);
      if (!appConfig) {
        this.fail(
          "Unable to determine app configuration",
          flags,
          "logSubscribe",
        );
      }
      const logsChannelName = `[meta]log`;

      // Configure channel options for rewind if specified
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
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // Determine which log types to subscribe to
      const logTypes = flags.type
        ? [flags.type]
        : [
            "channel.lifecycle",
            "channel.occupancy",
            "channel.presence",
            "connection.lifecycle",
            "push.publish",
          ];

      this.logCliEvent(
        flags,
        "logs",
        "subscribing",
        `Subscribing to log events: ${logTypes.join(", ")}`,
        { logTypes, channel: logsChannelName },
      );

      // Subscribe to specified log types
      const subscribePromises: Promise<unknown>[] = [];
      for (const logType of logTypes) {
        subscribePromises.push(
          channel.subscribe(logType, (message: Ably.Message) => {
            const timestamp = formatMessageTimestamp(message.timestamp);
            const event = {
              logType,
              timestamp,
              data: message.data as unknown,
              id: message.id,
            };
            this.logCliEvent(
              flags,
              "logs",
              "logReceived",
              `Log received: ${logType}`,
              event,
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent({ log: event }, flags);
            } else {
              this.log(
                `${formatTimestamp(timestamp)} Type: ${formatEventType(logType)}`,
              );

              if (message.data !== null && message.data !== undefined) {
                this.log(
                  `${formatLabel("Data")} ${JSON.stringify(message.data, null, 2)}`,
                );
              }

              this.log(""); // Empty line for better readability
            }
          }),
        );
      }

      await Promise.all(subscribePromises);

      this.logSuccessMessage(
        `Subscribed to app logs: ${formatResource(logTypes.join(", "))}.`,
        flags,
      );

      this.logCliEvent(
        flags,
        "logs",
        "listening",
        "Listening for log events. Press Ctrl+C to exit.",
      );
      this.logListening("Listening for log events.", flags);

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "logs", flags.duration);
    } catch (error) {
      this.fail(error, flags, "logSubscribe");
    }
  }
}
