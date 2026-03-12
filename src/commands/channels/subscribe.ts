import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import { AblyBaseCommand } from "../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../flags.js";
import { formatMessageData } from "../../utils/json-formatter.js";
import {
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatMessageTimestamp,
  formatIndex,
  formatLabel,
  formatEventType,
} from "../../utils/output.js";

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
  };

  static override strict = false;

  private client: Ably.Realtime | null = null;
  private sequenceCounter = 0;

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
          const timestamp = formatMessageTimestamp(message.timestamp);
          const messageEvent = {
            channel: channel.name,
            clientId: message.clientId,
            connectionId: message.connectionId,
            data: message.data,
            encoding: message.encoding,
            event: message.name || "(none)",
            id: message.id,
            timestamp,
            action:
              message.action === undefined ? undefined : String(message.action),
            serial: message.serial,
            version: message.version,
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
            this.logJsonEvent(messageEvent, flags);
          } else {
            const name = message.name || "(none)";
            const sequencePrefix = flags["sequence-numbers"]
              ? `${formatIndex(this.sequenceCounter)}`
              : "";

            // Message header with timestamp and channel info
            this.log(
              `${formatTimestamp(timestamp)}${sequencePrefix} ${formatResource(`Channel: ${channel.name}`)} | Event: ${formatEventType(name)}`,
            );

            // Action, serial, version
            if (message.action !== undefined) {
              this.log(
                `${formatLabel("Action")} ${formatEventType(String(message.action))}`,
              );
            }

            if (message.serial) {
              this.log(`${formatLabel("Serial")} ${message.serial}`);
            }

            if (message.version) {
              this.log(`${formatLabel("Version")} ${message.version}`);
            }

            // Message data with consistent formatting
            this.log(formatLabel("Data"));
            this.log(formatMessageData(message.data));

            this.log(""); // Empty line for better readability
          }
        });
      }

      // Wait for all channels to attach
      await Promise.all(attachPromises);

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
      }

      this.logCliEvent(
        flags,
        "subscribe",
        "listening",
        "Listening for messages. Press Ctrl+C to exit.",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "subscribe", flags.duration);
    } catch (error) {
      this.fail(error, flags, "channelSubscribe", {
        channels: channelNames,
      });
    }
  }
}
