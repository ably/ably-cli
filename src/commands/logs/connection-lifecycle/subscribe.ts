import { Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

export default class LogsConnectionLifecycleSubscribe extends AblyBaseCommand {
  static override description = "Subscribe to live connection lifecycle logs";

  static override examples = [
    "$ ably logs connection-lifecycle subscribe",
    "$ ably logs connection-lifecycle subscribe --json",
    "$ ably logs connection-lifecycle subscribe --pretty-json",
    "$ ably logs connection-lifecycle subscribe --duration 30",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
    rewind: Flags.integer({
      description: "Number of messages to replay from history when subscribing",
      default: 0,
      required: false,
    }),
  };

  private cleanupInProgress = false;
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
      const channelOptions = flags.rewind
        ? { params: { rewind: String(flags.rewind) } }
        : undefined;
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
        this.log(`${chalk.green("Subscribing to connection lifecycle logs")}`);
      }

      // Subscribe to connection lifecycle logs
      channel.subscribe((message: Ably.Message) => {
        const timestamp = message.timestamp
          ? new Date(message.timestamp).toISOString()
          : new Date().toISOString();
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
            `${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(`Event: ${event.event}`)}`,
          );

          if (message.data !== null && message.data !== undefined) {
            this.log(
              `${chalk.green("Data:")} ${JSON.stringify(message.data, null, 2)}`,
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
        this.log(
          "Listening for connection lifecycle log events. Press Ctrl+C to exit.",
        );
      }

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
      this.logCliEvent(flags, "logs", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal";
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "logs",
        "fatalError",
        `Error during connection lifecycle logs subscription: ${errorMsg}`,
        { error: errorMsg },
      );
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(`Error: ${errorMsg}`);
      }
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
