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
    "$ ably channels subscribe my-channel --token-streaming",
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

  private activeDisplaySerial: string | null = null; // Which serial owns the current TTY in-place line
  private client: Ably.Realtime | null = null;
  private sequenceCounter = 0;
  private tokenStreams = new Map<
    string,
    { accumulatedData: string; appendCount: number }
  >();

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

      if (flags["token-streaming"] && channelNames.length > 1) {
        this.fail(
          "Token streaming mode supports only a single channel",
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

      // Finalize any in-progress streams before exit
      if (flags["token-streaming"]) {
        this.finalizeAllTokenStreams(flags);
      }
    } catch (error) {
      this.fail(error, flags, "channelSubscribe", {
        channels: channelNames,
      });
    }
  }

  // End the TTY in-place line for the active display serial without removing the stream from the Map
  private endDisplayLine(flags: Record<string, unknown>): void {
    if (!this.activeDisplaySerial) return;
    const state = this.tokenStreams.get(this.activeDisplaySerial);

    if (!this.shouldOutputJson(flags)) {
      if (this.shouldUseTerminalUpdates()) {
        process.stdout.write("\n");
      }

      if (state && state.appendCount > 0) {
        this.log(
          chalk.dim(
            `  (${state.appendCount} append${state.appendCount === 1 ? "" : "s"})`,
          ),
        );
      }

      this.log("");
    }

    this.activeDisplaySerial = null;
  }

  private finalizeTokenStream(
    flags: Record<string, unknown>,
    serial?: string,
  ): void {
    if (serial) {
      if (!this.tokenStreams.has(serial)) return;

      if (this.activeDisplaySerial === serial) {
        this.endDisplayLine(flags);
      } else {
        // Stream is not the active display line but still has state — show its append summary
        const state = this.tokenStreams.get(serial);
        if (state && state.appendCount > 0 && !this.shouldOutputJson(flags)) {
          this.log(
            chalk.dim(
              `  (${state.appendCount} append${state.appendCount === 1 ? "" : "s"})`,
            ),
          );
        }
      }

      this.tokenStreams.delete(serial);
    } else {
      // Finalize whatever is active (used by non-stream-action fallthrough)
      if (this.activeDisplaySerial) {
        this.finalizeTokenStream(flags, this.activeDisplaySerial);
      }
    }
  }

  private finalizeAllTokenStreams(flags: Record<string, unknown>): void {
    for (const [serial] of this.tokenStreams) {
      this.finalizeTokenStream(flags, serial);
    }
  }

  private handleTokenStreamMessage(
    message: Ably.Message,
    channelName: string,
    flags: Record<string, unknown>,
  ): void {
    const action =
      message.action === undefined ? undefined : String(message.action);

    const serial = message.serial;

    const streamLabel = `${formatResource(channelName)} ${chalk.dim("[")}${formatEventType("token-stream")}${chalk.dim("]")}`;

    // Handle message.update as stream replacement when serial matches a tracked stream
    if (action === "message.update") {
      if (serial && this.tokenStreams.has(serial)) {
        // Replace accumulated data (resync/conflation scenario)
        const dataStr = message.data == null ? "" : String(message.data);
        const state = this.tokenStreams.get(serial)!;
        state.accumulatedData = dataStr;
        state.appendCount = 0;

        this.logCliEvent(
          flags,
          "subscribe",
          "streamUpdateReceived",
          `Received stream update (replacement) on channel ${channelName}`,
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
                accumulatedData: dataStr,
                encoding: message.encoding,
                ...(message.name ? { name: message.name } : {}),
                clientId: message.clientId,
                connectionId: message.connectionId,
                timestamp: formatMessageTimestamp(message.timestamp),
              },
            },
            flags,
          );
        } else if (
          this.shouldUseTerminalUpdates() &&
          this.activeDisplaySerial === serial
        ) {
          process.stdout.write(`\r\u001B[K${streamLabel} ${dataStr}`);
        } else if (!this.shouldUseTerminalUpdates()) {
          this.log(`${streamLabel} ${dataStr}`);
        }
        return;
      }

      // message.update with unknown serial or no tracked stream: fall through to normal display
      this.finalizeTokenStream(flags);
      this.displayNormalMessage(message, channelName, flags);
      return;
    }

    // Only handle create/append in stream mode; everything else falls through
    if (action !== "message.create" && action !== "message.append") {
      this.finalizeTokenStream(flags);
      this.displayNormalMessage(message, channelName, flags);
      return;
    }

    const dataStr = message.data == null ? "" : String(message.data);

    if (action === "message.create") {
      // If a different serial currently owns the TTY display, end its line (but keep it in the Map)
      if (this.activeDisplaySerial && this.activeDisplaySerial !== serial) {
        this.endDisplayLine(flags);
      }

      this.tokenStreams.set(serial!, {
        accumulatedData: dataStr,
        appendCount: 0,
      });
      this.activeDisplaySerial = serial!;

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
        process.stdout.write(`${streamLabel} ${dataStr}`);
      } else {
        this.log(`${streamLabel} ${dataStr}`);
      }
    } else {
      // message.append
      const state = this.tokenStreams.get(serial!);
      if (!state) {
        // Late arrival for already-finalized stream — ignore gracefully
        return;
      }

      state.accumulatedData += dataStr;
      state.appendCount++;

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
          appendCount: state.appendCount,
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
              accumulatedData: state.accumulatedData,
              appendCount: state.appendCount,
              ...(message.name ? { name: message.name } : {}),
              clientId: message.clientId,
              connectionId: message.connectionId,
              timestamp: formatMessageTimestamp(message.timestamp),
            },
          },
          flags,
        );
      } else if (
        this.shouldUseTerminalUpdates() &&
        this.activeDisplaySerial === serial
      ) {
        process.stdout.write(
          `\r\u001B[K${streamLabel} ${state.accumulatedData}`,
        );
      } else if (!this.shouldUseTerminalUpdates()) {
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
