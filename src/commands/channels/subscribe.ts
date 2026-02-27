import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
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
    "$ ably channels subscribe --stream my-channel",
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
    stream: Flags.boolean({
      default: false,
      description:
        "Stream mode: concatenates message.append data for the same serial, rewriting output in-place",
    }),
  };

  static override strict = false;

  private cleanupInProgress = false;
  private client: Ably.Realtime | null = null;
  private sequenceCounter = 0;

  // Stream mode state
  private streamCurrentSerial: string | null = null;
  private streamAppendCount = 0;

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
            ...(flags.stream
              ? { action: message.action, serial: message.serial }
              : {}),
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
          } else if (flags.stream && message.serial) {
            this.handleStreamMessage(message, channel.name, timestamp);
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

      // Finalize any in-progress stream output
      if (flags.stream && this.streamCurrentSerial !== null) {
        this.finalizeStream();
      }

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
    }
  }

  private handleStreamMessage(
    message: Ably.Message,
    channelName: string,
    timestamp: string,
  ): void {
    const action = message.action;
    const serial = message.serial!;
    const data =
      typeof message.data === "string"
        ? message.data
        : JSON.stringify(message.data);

    // If we see a new serial, finalize the previous stream and start a new one
    if (serial !== this.streamCurrentSerial) {
      if (this.streamCurrentSerial !== null) {
        this.finalizeStream();
      }

      this.streamCurrentSerial = serial;
      this.streamAppendCount = 0;
    }

    if (action === "message.create" || action === "message.append") {
      this.streamAppendCount++;
      const header = `${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(channelName)}`;

      if (this.shouldUseTerminalUpdates()) {
        // TTY: stream tokens inline — each append just writes its delta
        if (action === "message.create") {
          process.stdout.write(`${header} ${data}`);
        } else {
          process.stdout.write(data);
        }
      } else {
        // Non-TTY / test: log each delta on its own line (captured by test runner)
        this.log(`${header} ${data}`);
      }
    } else {
      // For other actions (message.update, message.delete, etc.), display normally
      const name = message.name || "(none)";
      this.log(
        `${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(`Channel: ${channelName}`)} | ${chalk.yellow(`Event: ${name}`)} | ${chalk.dim(`Action: ${action}`)}`,
      );
      this.log(`${chalk.blue("Data:")} ${data}`);
      this.log("");
    }
  }

  private finalizeStream(): void {
    const countLabel = `${this.streamAppendCount} msg${this.streamAppendCount === 1 ? "" : "s"}`;
    if (this.shouldUseTerminalUpdates()) {
      process.stdout.write(`\n${chalk.dim(`[${countLabel}]`)}\n\n`);
    } else {
      this.log(chalk.dim(`[${countLabel}]`));
      this.log("");
    }
  }
}
