import { Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { formatJson, isJsonData } from "../../../utils/json-formatter.js";

export default class LogsPushSubscribe extends AblyBaseCommand {
  static override description =
    "Stream logs from the push notifications meta channel [meta]log:push";

  static override examples = [
    "$ ably logs push subscribe",
    "$ ably logs push subscribe --rewind 10",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    json: Flags.boolean({
      default: false,
      description: "Output results as JSON",
    }),
    rewind: Flags.integer({
      default: 0,
      description: "Number of messages to rewind when subscribing",
    }),
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
      if (flags.rewind > 0) {
        this.logCliEvent(
          flags,
          "logs",
          "rewindEnabled",
          `Rewind enabled for ${channelName}`,
          { channel: channelName, count: flags.rewind },
        );
        channelOptions.params = {
          ...channelOptions.params,
          rewind: flags.rewind.toString(),
        };
      }

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
        this.log(`Subscribing to ${chalk.cyan(channelName)}...`);
        this.log("Press Ctrl+C to exit");
        this.log("");
      }

      // Subscribe to the channel
      channel.subscribe((message) => {
        const timestamp = message.timestamp
          ? new Date(message.timestamp).toISOString()
          : new Date().toISOString();
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
          this.log(this.formatJsonOutput(logEvent, flags));
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
          `${chalk.dim(`[${timestamp}]`)} Channel: ${chalk.cyan(channelName)} | Event: ${eventColor(event)}`,
        );
        if (message.data) {
          if (isJsonData(message.data)) {
            this.log("Data:");
            this.log(formatJson(message.data));
          } else {
            this.log(`Data: ${message.data}`);
          }
        }

        this.log("");
      });
      this.logCliEvent(
        flags,
        "logs",
        "subscribed",
        `Successfully subscribed to ${channelName}`,
      );

      // Set up cleanup for when the process is terminated
      const cleanup = () => {
        this.logCliEvent(
          flags,
          "logs",
          "cleanupInitiated",
          "Cleanup initiated (Ctrl+C pressed)",
        );
        // Client cleanup is handled by command finally() method
        this.logCliEvent(
          flags,
          "connection",
          "cleanup",
          "Client cleanup will be handled by base class.",
        );
      };

      // Handle process termination
      process.on("SIGINT", () => {
        if (!this.shouldOutputJson(flags)) {
          this.log("\nSubscription ended");
        }

        cleanup();

        process.exit(0); // Reinstated: Explicit exit on signal
      });
      process.on("SIGTERM", () => {
        cleanup();

        process.exit(0); // Reinstated: Explicit exit on signal
      });

      this.logCliEvent(flags, "logs", "listening", "Listening for logs...");
      // Wait indefinitely
      await new Promise(() => {});
    } catch (error: unknown) {
      const err = error as Error;
      this.logCliEvent(
        flags,
        "logs",
        "fatalError",
        `Error during log subscription: ${err.message}`,
        { error: err.message },
      );
      this.error(err.message);
    }
    // Client cleanup is handled by command finally() method
  }
}
