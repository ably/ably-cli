import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import { AblyBaseCommand } from "../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../flags.js";
import {
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
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels subscribe my-channel',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
    ...rewindFlag,
    "cipher-algorithm": Flags.string({
      default: "aes",
      description: "Encryption algorithm to use",
    }),
    "cipher-key": Flags.string({
      description:
        "Encryption key for decrypting messages (base64-encoded or hex-encoded)",
    }),
    "cipher-key-length": Flags.integer({
      default: 256,
      description: "Length of encryption key in bits",
    }),
    "cipher-mode": Flags.string({
      default: "cbc",
      description: "Cipher mode to use",
    }),
    delta: Flags.boolean({
      default: false,
      description:
        "Enable delta compression (VCDIFF) to reduce message payload sizes",
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
    this.validateChannelName(parseResult.args, flags, channelNames);

    let channels: Ably.RealtimeChannel[] = [];

    try {
      // Create the Ably client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;

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
          const timestamp = formatMessageTimestamp(message.timestamp);
          const messageData = {
            id: message.id,
            timestamp,
            channel: channel.name,
            event: message.name || "(none)",
            clientId: message.clientId,
            connectionId: message.connectionId,
            data: message.data,
            encoding: message.encoding,
            action:
              message.action === undefined ? undefined : String(message.action),
            serial: message.serial,
            version: message.version,
            annotations: message.annotations,
            ...(flags["sequence-numbers"]
              ? { sequence: this.sequenceCounter }
              : {}),
          };
          this.logCliEvent(
            flags,
            "subscribe",
            "messageReceived",
            `Received message on channel ${channel.name}`,
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
                message.action === undefined
                  ? undefined
                  : String(message.action),
              channel: channel.name,
              clientId: message.clientId,
              data: message.data,
              event: message.name || "(none)",
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
            this.log(""); // Empty line for readability between messages
          }
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
    } catch (error) {
      this.fail(error, flags, "channelSubscribe", {
        channels: channelNames,
      });
    }
  }
}
