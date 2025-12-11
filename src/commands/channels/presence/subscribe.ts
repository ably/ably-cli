import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

export default class ChannelsPresenceSubscribe extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to subscribe to presence events",
      required: true,
    }),
  };

  static override description = "Subscribe to presence events on a channel";

  static override examples = [
    "$ ably channels presence subscribe my-channel",
    '$ ably channels presence subscribe my-channel --client-id "filter123"',
    '$ ably channels presence subscribe my-channel --api-key "YOUR_API_KEY"',
    '$ ably channels presence subscribe my-channel --token "YOUR_ABLY_TOKEN"',
    "$ ably channels presence subscribe my-channel --json",
    "$ ably channels presence subscribe my-channel --pretty-json",
    "$ ably channels presence subscribe my-channel --duration 30",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
  };

  private cleanupInProgress = false;
  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPresenceSubscribe);
    let channel: Ably.RealtimeChannel | null = null;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const channelName = args.channel;

      channel = client.channels.get(channelName);

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Set up channel state logging
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to presence events
      this.logCliEvent(
        flags,
        "presence",
        "subscribing",
        `Subscribing to presence events on channel: ${channelName}`,
        { channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          `${chalk.green("Subscribing to presence events on channel:")} ${chalk.cyan(channelName)}`,
        );
      }

      channel.presence.subscribe((presenceMessage: Ably.PresenceMessage) => {
        const timestamp = presenceMessage.timestamp
          ? new Date(presenceMessage.timestamp).toISOString()
          : new Date().toISOString();
        const event = {
          action: presenceMessage.action,
          channel: channelName,
          clientId: presenceMessage.clientId,
          connectionId: presenceMessage.connectionId,
          data: presenceMessage.data,
          id: presenceMessage.id,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "presence",
          presenceMessage.action!,
          `Presence event: ${presenceMessage.action} by ${presenceMessage.clientId}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(event, flags));
        } else {
          const action = presenceMessage.action || "unknown";
          const clientId = presenceMessage.clientId || "Unknown";

          this.log(
            `${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(`Channel: ${channelName}`)} | ${chalk.yellow(`Action: ${action}`)} | ${chalk.blue(`Client: ${clientId}`)}`,
          );

          if (
            presenceMessage.data !== null &&
            presenceMessage.data !== undefined
          ) {
            this.log(
              `${chalk.green("Data:")} ${JSON.stringify(presenceMessage.data, null, 2)}`,
            );
          }

          this.log(""); // Empty line for better readability
        }
      });

      this.logCliEvent(
        flags,
        "presence",
        "listening",
        "Listening for presence events. Press Ctrl+C to exit.",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log("Listening for presence events. Press Ctrl+C to exit.");
      }

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
      this.logCliEvent(flags, "presence", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal";
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "presence",
        "fatalError",
        `Error during presence subscription: ${errorMsg}`,
        { channel: args.channel, error: errorMsg },
      );
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { channel: args.channel, error: errorMsg, success: false },
          flags,
        );
      } else {
        this.error(`Error: ${errorMsg}`);
      }
    }
  }
}
