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
  formatLabel,
  formatListening,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatMessageTimestamp,
} from "../../../utils/output.js";

export default class LogsChannelLifecycleSubscribe extends AblyBaseCommand {
  static override description =
    "Stream logs from [meta]channel.lifecycle meta channel";

  static override examples = [
    "$ ably logs channel-lifecycle subscribe",
    "$ ably logs channel-lifecycle subscribe --rewind 10",
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
    const { flags } = await this.parse(LogsChannelLifecycleSubscribe);

    const channelName = "[meta]channel.lifecycle";

    try {
      // Create the Ably client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const { client } = this; // local const
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
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(`Subscribed to ${formatResource(channelName)}.`),
        );
        this.log(formatListening("Listening for channel lifecycle logs."));
        this.log("");
      }

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

        // Color-code different event types
        let eventColor = chalk.blue;

        // For channel lifecycle events
        if (event.includes("attached")) {
          eventColor = chalk.green;
        } else if (event.includes("detached")) {
          eventColor = chalk.yellow;
        } else if (event.includes("failed")) {
          eventColor = chalk.red;
        } else if (event.includes("suspended")) {
          eventColor = chalk.magenta;
        }

        // Format the log output with consistent styling
        this.log(
          `${formatTimestamp(timestamp)} Channel: ${formatResource(channelName)} | ${eventColor(`Event: ${event}`)}`,
        );

        if (message.data) {
          this.log(formatLabel("Data"));
          this.log(formatMessageData(message.data));
        }

        this.log(""); // Empty line for better readability
      });
      this.logCliEvent(
        flags,
        "logs",
        "subscribed",
        `Subscribed to ${channelName}`,
      );

      this.logCliEvent(flags, "logs", "listening", "Listening for logs...");
      await this.waitAndTrackCleanup(flags, "logs", flags.duration);
    } catch (error: unknown) {
      this.fail(error, flags, "ChannelLifecycleSubscribe", {
        channel: channelName,
      });
    }
    // Client cleanup is handled by command finally() method
  }
}
