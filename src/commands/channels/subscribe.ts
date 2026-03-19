import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";
import { AblyBaseCommand } from "../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../flags.js";
import {
  formatEventType,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatMessageTimestamp,
  formatIndex,
  formatMessagesOutput,
} from "../../utils/output.js";
import type { MessageDisplayFields } from "../../utils/output.js";

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
    "$ ably channels subscribe --rewind 10 my-channel",
    "$ ably channels subscribe --delta my-channel",
    "$ ably channels subscribe --cipher-key YOUR_CIPHER_KEY my-channel",
    "$ ably channels subscribe my-channel --json",
    "$ ably channels subscribe my-channel --pretty-json",
    "$ ably channels subscribe my-channel --duration 30",
    "$ ably channels subscribe --token-streaming my-channel",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels subscribe my-channel',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
    ...rewindFlag,
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
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
    "token-streaming": Flags.boolean({
      default: false,
      description:
        "Enable token streaming mode: accumulates message.append data for the same serial, displaying the growing response in-place (requires message interactions enabled on the channel)",
    }),
  };

  static override strict = false;

  private client: Ably.Realtime | null = null;
  private sequenceCounter = 0;
  private tokenStreamAccumulatedData = "";
  private tokenStreamAppendCount = 0;
  private tokenStreamSerial: string | null = null;

  async run(): Promise<void> {
    const parseResult = await this.parse(ChannelsSubscribe);
    const { flags } = parseResult;

    // Get all channel names from argv
    const channelNames = parseResult.argv as string[];
    let channels: Ably.RealtimeChannel[] = [];

    try {
      // Create the Ably client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;

      if (channelNames.length === 0) {
        this.fail(
          "At least one channel name is required",
          flags,
          "channelSubscribe",
        );
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
        this.configureRewind(
          channelOptions,
          flags.rewind,
          flags,
          "subscribe",
          channelName,
        );

        return client!.channels.get(channelName, channelOptions);
      });

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to messages on all channels
      const subscribePromises: Promise<unknown>[] = [];

      for (const channel of channels) {
        this.logCliEvent(
          flags,
          "subscribe",
          "subscribing",
          `Subscribing to channel: ${channel.name}`,
          { channel: channel.name },
        );
        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Attaching to channel: ${formatResource(channel.name)}`,
            ),
          );
        }

        // Set up channel state logging
        this.setupChannelStateLogging(channel, flags, {
          includeUserFriendlyMessages: true,
        });

        // Subscribe and collect promise (rejects on capability/auth errors)
        const subscribePromise = channel.subscribe((message: Ably.Message) => {
          this.sequenceCounter++;

          // Stream mode: handle message.create/append accumulation
          if (flags["token-streaming"] && message.serial) {
            this.handleTokenStreamMessage(message, channel.name, flags);
            return;
          }

          this.displayNormalMessage(message, channel.name, flags);
        });
        subscribePromises.push(subscribePromise);
      }

      // Wait for all channels to attach via subscribe
      await Promise.all(subscribePromises);

      // Log the ready signal for E2E tests
      if (channelNames.length === 1 && !this.shouldOutputJson(flags)) {
        this.log(`Successfully attached to channel: ${channelNames[0]}`);
      }

      // Show success message once all channels are attached
      if (!this.shouldOutputJson(flags)) {
        if (channelNames.length === 1) {
          this.log(
            formatSuccess(
              `Subscribed to channel: ${formatResource(channelNames[0])}.`,
            ),
          );
        } else {
          this.log(
            formatSuccess(`Subscribed to ${channelNames.length} channels.`),
          );
        }

        this.log(formatListening("Listening for messages."));
        this.log("");
      }

      this.logCliEvent(
        flags,
        "subscribe",
        "listening",
        "Listening for messages. Press Ctrl+C to exit.",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "subscribe", flags.duration);

      // Finalize any in-progress stream before exit
      if (flags["token-streaming"]) {
        this.finalizeTokenStream(flags);
      }
    } catch (error) {
      this.fail(error, flags, "channelSubscribe", {
        channels: channelNames,
      });
    }
  }

  private finalizeTokenStream(flags: Record<string, unknown>): void {
    if (this.tokenStreamSerial === null) return;

    if (!this.shouldOutputJson(flags)) {
      if (this.shouldUseTerminalUpdates()) {
        // Using process.stdout.write to end the in-place line update started in handleTokenStreamMessage
        process.stdout.write("\n");
      }
      if (this.tokenStreamAppendCount > 0) {
        this.log(
          chalk.dim(
            `  (${this.tokenStreamAppendCount} append${this.tokenStreamAppendCount === 1 ? "" : "s"})`,
          ),
        );
      }
      this.log("");
    }

    this.tokenStreamSerial = null;
    this.tokenStreamAccumulatedData = "";
    this.tokenStreamAppendCount = 0;
  }

  private handleTokenStreamMessage(
    message: Ably.Message,
    channelName: string,
    flags: Record<string, unknown>,
  ): void {
    const action =
      message.action === undefined ? undefined : String(message.action);

    // Only handle create/append in stream mode; everything else falls through
    if (action !== "message.create" && action !== "message.append") {
      // Non-streaming action: finalize any in-progress stream, then display normally
      this.finalizeTokenStream(flags);
      this.displayNormalMessage(message, channelName, flags);
      return;
    }

    const serial = message.serial!;

    // If serial changed, finalize the previous stream
    if (this.tokenStreamSerial !== null && this.tokenStreamSerial !== serial) {
      this.finalizeTokenStream(flags);
    }

    const dataStr = message.data == null ? "" : String(message.data);

    const streamLabel = `${formatResource(channelName)} ${chalk.dim("[")}${formatEventType("token-stream")}${chalk.dim("]")}`;

    if (action === "message.create") {
      this.tokenStreamSerial = serial;
      this.tokenStreamAccumulatedData = dataStr;
      this.tokenStreamAppendCount = 0;

      this.logCliEvent(
        flags,
        "subscribe",
        "streamCreateReceived",
        `Received stream create on channel ${channelName}`,
        { action, serial, channel: channelName, data: dataStr },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonEvent(
          {
            message: {
              id: message.id,
              action,
              serial,
              channel: channelName,
              data: dataStr,
              encoding: message.encoding,
              ...(message.name ? { name: message.name } : {}),
              clientId: message.clientId,
              connectionId: message.connectionId,
              timestamp: formatMessageTimestamp(message.timestamp),
            },
          },
          flags,
        );
      } else if (this.shouldUseTerminalUpdates()) {
        // Using process.stdout.write instead of this.log() to avoid trailing newline,
        // enabling in-place line updates via \r for streaming token display
        process.stdout.write(`${streamLabel} ${dataStr}`);
      } else {
        this.log(`${streamLabel} ${dataStr}`);
      }
    } else {
      // message.append
      this.tokenStreamAccumulatedData += dataStr;
      this.tokenStreamAppendCount++;

      this.logCliEvent(
        flags,
        "subscribe",
        "streamAppendReceived",
        `Received stream append on channel ${channelName}`,
        {
          action,
          serial,
          channel: channelName,
          data: dataStr,
          appendCount: this.tokenStreamAppendCount,
        },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonEvent(
          {
            message: {
              id: message.id,
              action,
              serial,
              channel: channelName,
              data: dataStr,
              encoding: message.encoding,
              accumulatedData: this.tokenStreamAccumulatedData,
              appendCount: this.tokenStreamAppendCount,
              ...(message.name ? { name: message.name } : {}),
              clientId: message.clientId,
              connectionId: message.connectionId,
              timestamp: formatMessageTimestamp(message.timestamp),
            },
          },
          flags,
        );
      } else if (this.shouldUseTerminalUpdates()) {
        // Using process.stdout.write with \r to overwrite the current line in-place,
        // showing accumulated token data without scrolling — this.log() can't do \r rewriting
        process.stdout.write(
          `\r${streamLabel} ${this.tokenStreamAccumulatedData}`,
        );
      } else {
        this.log(`${chalk.dim("+")} ${dataStr}`);
      }
    }
  }

  private displayNormalMessage(
    message: Ably.Message,
    channelName: string,
    flags: Record<string, unknown>,
  ): void {
    const timestamp = formatMessageTimestamp(message.timestamp);
    const messageData = {
      id: message.id,
      timestamp,
      channel: channelName,
      ...(message.name ? { name: message.name } : {}),
      clientId: message.clientId,
      connectionId: message.connectionId,
      data: message.data,
      encoding: message.encoding,
      action: message.action === undefined ? undefined : String(message.action),
      serial: message.serial,
      version: message.version,
      annotations: message.annotations,
      ...(flags["sequence-numbers"] ? { sequence: this.sequenceCounter } : {}),
    };
    this.logCliEvent(
      flags,
      "subscribe",
      "messageReceived",
      `Received message on channel ${channelName}`,
      messageData,
    );

    if (this.shouldOutputJson(flags)) {
      this.logJsonEvent(
        {
          message: messageData,
          ...(flags["sequence-numbers"]
            ? { sequence: this.sequenceCounter }
            : {}),
        },
        flags,
      );
    } else {
      const msgFields: MessageDisplayFields = {
        action:
          message.action === undefined ? undefined : String(message.action),
        channel: channelName,
        clientId: message.clientId,
        data: message.data,
        ...(message.name ? { name: message.name } : {}),
        id: message.id,
        serial: message.serial,
        timestamp: message.timestamp ?? Date.now(),
        version: message.version,
        annotations: message.annotations,
        ...(flags["sequence-numbers"]
          ? { sequencePrefix: `${formatIndex(this.sequenceCounter)} ` }
          : {}),
      };
      this.log(formatMessagesOutput([msgFields]));
      this.log("");
    }
  }
}
