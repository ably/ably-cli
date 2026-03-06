import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../flags.js";
import { waitUntilInterruptedOrTimeout } from "../../utils/long-running.js";
import {
  formatMessagesOutput,
  listening,
  progress,
  resource,
  success,
  toMessageJson,
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
      description: "Automatically exit after N seconds",
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
          this.log(progress(`Attaching to channel: ${resource(channel.name)}`));
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

          const msgFields: MessageDisplayFields = {
            channel: channel.name,
            clientId: message.clientId,
            data: message.data,
            event: message.name || "(none)",
            id: message.id,
            serial: (message as Record<string, unknown>).serial as
              | string
              | undefined,
            sequencePrefix: flags["sequence-numbers"]
              ? `[${this.sequenceCounter}]`
              : undefined,
            timestamp,
          };

          this.logCliEvent(
            flags,
            "subscribe",
            "messageReceived",
            `Received message on channel ${channel.name}`,
            { ...msgFields },
          );

          if (this.shouldOutputJson(flags)) {
            this.log(this.formatJsonOutput(toMessageJson(msgFields), flags));
          } else {
            this.log(formatMessagesOutput([msgFields]));
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
            success(`Subscribed to channel: ${resource(channelNames[0])}.`),
          );
        } else {
          this.log(success(`Subscribed to ${channelNames.length} channels.`));
        }

        this.log(listening("Listening for messages."));
        this.log("");
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
    }
  }
}
