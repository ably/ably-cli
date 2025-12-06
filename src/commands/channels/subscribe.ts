import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { BaseFlags } from "../../types/cli.js";
import { formatJson, isJsonData } from "../../utils/json-formatter.js";
import { waitUntilInterruptedOrTimeout } from "../../utils/long-running.js";

export default class ChannelsSubscribe extends AblyBaseCommand {
  static override args = {
    channels: Args.string({
      description: "Channel name(s) to subscribe to",
      multiple: false,
      required: true,
    }),
  };

  static override description =
    "Subscribe to messages published on one or more Ably channels";

  static override examples = [
    "$ ably channels subscribe my-channel",
    "$ ably channels subscribe my-channel another-channel",
    '$ ably channels subscribe --api-key "YOUR_API_KEY" my-channel',
    '$ ably channels subscribe --token "YOUR_ABLY_TOKEN" my-channel',
    "$ ably channels subscribe --rewind 10 my-channel",
    "$ ably channels subscribe --delta my-channel",
    "$ ably channels subscribe --cipher-key YOUR_CIPHER_KEY my-channel",
    "$ ably channels subscribe my-channel --json",
    "$ ably channels subscribe my-channel --pretty-json",
    "$ ably channels subscribe my-channel --duration 30",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    "cipher-algorithm": Flags.string({
      default: "aes",
      description: "Encryption algorithm to use (default: aes)",
    }),
    "cipher-key": Flags.string({
      description: "Encryption key for decrypting messages (hex-encoded)",
    }),
    "cipher-key-length": Flags.integer({
      default: 256,
      description: "Length of encryption key in bits (default: 256)",
    }),
    "cipher-mode": Flags.string({
      default: "cbc",
      description: "Cipher mode to use (default: cbc)",
    }),
    delta: Flags.boolean({
      default: false,
      description: "Enable delta compression for messages",
    }),
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
    rewind: Flags.integer({
      default: 0,
      description: "Number of messages to rewind when subscribing (default: 0)",
    }),
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
  };

  static override strict = false;

  private cleanupInProgress = false;
  private client: Ably.Realtime | null = null;
  private sequenceCounter = 0;

  async run(): Promise<void> {
    const { flags } = await this.parse(ChannelsSubscribe);
    const _args = await this.parse(ChannelsSubscribe);

    // Get all channel names from argv
    const channelNames = _args.argv as string[];
    let channels: Ably.RealtimeChannel[] = [];

    try {
      // Create the Ably client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;

      if (channelNames.length === 0) {
        const errorMsg = "At least one channel name is required";
        this.logCliEvent(flags, "subscribe", "validationError", errorMsg, {
          error: errorMsg,
        });
        if (this.shouldOutputJson(flags)) {
          this.jsonError({ error: errorMsg, success: false }, flags);
          return;
        } else {
          this.error(errorMsg);
        }

        return;
      }

      // Setup channels with appropriate options
      channels = channelNames.map((channelName: string) => {
        const channelOptions: Ably.ChannelOptions = {};

        // Configure encryption if cipher key is provided
        if (flags["cipher-key"]) {
          channelOptions.cipher = {
            algorithm: flags["cipher-algorithm"],
            key: flags["cipher-key"],
            keyLength: flags["cipher-key-length"],
            mode: flags["cipher-mode"],
          };
          this.logCliEvent(
            flags,
            "subscribe",
            "encryptionEnabled",
            `Encryption enabled for channel ${channelName}`,
            { algorithm: flags["cipher-algorithm"], channel: channelName },
          );
        }

        // Configure delta compression
        if (flags.delta) {
          channelOptions.params = {
            ...channelOptions.params,
            delta: "vcdiff",
          };
          this.logCliEvent(
            flags,
            "subscribe",
            "deltaEnabled",
            `Delta compression enabled for channel ${channelName}`,
            { channel: channelName },
          );
        }

        // Configure rewind
        if (flags.rewind > 0) {
          channelOptions.params = {
            ...channelOptions.params,
            rewind: flags.rewind.toString(),
          };
          this.logCliEvent(
            flags,
            "subscribe",
            "rewindEnabled",
            `Rewind enabled for channel ${channelName}`,
            { channel: channelName, count: flags.rewind },
          );
        }

        return client!.channels.get(channelName, channelOptions);
      });

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to messages on all channels
      const attachPromises: Promise<void>[] = [];

      for (const channel of channels) {
        this.logCliEvent(
          flags,
          "subscribe",
          "subscribing",
          `Subscribing to channel: ${channel.name}`,
          { channel: channel.name },
        );
        if (!this.shouldOutputJson(flags)) {
          this.log(`Attaching to channel: ${chalk.cyan(channel.name)}...`);
        }

        // Set up channel state logging
        this.setupChannelStateLogging(channel, flags, {
          includeUserFriendlyMessages: true,
        });

        // Track attachment promise
        const attachPromise = new Promise<void>((resolve) => {
          const checkAttached = () => {
            if (channel.state === "attached") {
              resolve();
            }
          };
          channel.once("attached", checkAttached);
          checkAttached(); // Check if already attached
        });
        attachPromises.push(attachPromise);

        channel.subscribe((message: Ably.Message) => {
          this.sequenceCounter++;
          const timestamp = message.timestamp
            ? new Date(message.timestamp).toISOString()
            : new Date().toISOString();
          const messageEvent = {
            channel: channel.name,
            clientId: message.clientId,
            connectionId: message.connectionId,
            data: message.data,
            encoding: message.encoding,
            event: message.name || "(none)",
            id: message.id,
            timestamp,
            ...(flags["sequence-numbers"]
              ? { sequence: this.sequenceCounter }
              : {}),
          };
          this.logCliEvent(
            flags,
            "subscribe",
            "messageReceived",
            `Received message on channel ${channel.name}`,
            messageEvent,
          );

          if (this.shouldOutputJson(flags)) {
            this.log(this.formatJsonOutput(messageEvent, flags));
          } else {
            const name = message.name || "(none)";
            const sequencePrefix = flags["sequence-numbers"]
              ? `${chalk.dim(`[${this.sequenceCounter}]`)}`
              : "";

            // Message header with timestamp and channel info
            this.log(
              `${chalk.gray(`[${timestamp}]`)}${sequencePrefix} ${chalk.cyan(`Channel: ${channel.name}`)} | ${chalk.yellow(`Event: ${name}`)}`,
            );

            // Message data with consistent formatting
            if (isJsonData(message.data)) {
              this.log(chalk.blue("Data:"));
              this.log(formatJson(message.data));
            } else {
              this.log(`${chalk.blue("Data:")} ${message.data}`);
            }

            this.log(""); // Empty line for better readability
          }
        });
      }

      // Wait for all channels to attach
      await Promise.all(attachPromises);

      // Log the ready signal for E2E tests
      if (channelNames.length === 1) {
        this.log(`Successfully attached to channel ${channelNames[0]}`);
      }

      // Show success message once all channels are attached
      if (!this.shouldOutputJson(flags)) {
        if (channelNames.length === 1) {
          this.log(
            chalk.green(
              `✓ Subscribed to channel: ${chalk.cyan(channelNames[0])}. Listening for messages...`,
            ),
          );
        } else {
          this.log(
            chalk.green(
              `✓ Subscribed to ${channelNames.length} channels. Listening for messages...`,
            ),
          );
        }
      }

      this.logCliEvent(
        flags,
        "subscribe",
        "listening",
        "Listening for messages. Press Ctrl+C to exit.",
      );

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
      this.logCliEvent(flags, "subscribe", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal";
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "subscribe",
        "fatalError",
        `Error during subscription: ${errorMsg}`,
        { channels: channelNames, error: errorMsg },
      );
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { channels: channelNames, error: errorMsg, success: false },
          flags,
        );
        return;
      } else {
        this.error(`Error: ${errorMsg}`);
      }
    } finally {
      // Wrap all cleanup in a timeout to prevent hanging
      await Promise.race([
        this.performCleanup(flags || {}, channels),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            this.logCliEvent(
              flags || {},
              "subscribe",
              "cleanupTimeout",
              "Cleanup timed out after 5s, forcing completion",
            );
            resolve();
          }, 5000);
        }),
      ]);

      // Don't show cleanup messages for minimal output
    }
  }

  private async performCleanup(
    flags: BaseFlags,
    channels: Ably.RealtimeChannel[],
  ): Promise<void> {
    // Unsubscribe from all channels with timeout
    for (const channel of channels) {
      try {
        await Promise.race([
          Promise.resolve(channel.unsubscribe()),
          new Promise<void>((resolve) => setTimeout(resolve, 1000)),
        ]);
        this.logCliEvent(
          flags,
          "subscribe",
          "unsubscribedChannel",
          `Unsubscribed from ${channel.name}`,
        );
      } catch (error) {
        this.logCliEvent(
          flags,
          "subscribe",
          "unsubscribeError",
          `Error unsubscribing from ${channel.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Client cleanup is now handled by base class finally() method
    this.logCliEvent(
      flags,
      "connection",
      "clientCleanup",
      "Client cleanup will be handled by base class.",
    );
  }
}
