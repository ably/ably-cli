import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import { isJsonData } from "../../../utils/json-formatter.js";
import {
  formatClientId,
  formatEventType,
  formatIndex,
  formatLabel,
  formatListening,
  formatMessageTimestamp,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
} from "../../../utils/output.js";

export default class ChannelsPresenceEnter extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel to enter presence on",
      required: true,
    }),
  };

  static override description =
    "Enter presence on a channel and remains present until terminated.";

  static override examples = [
    "$ ably channels presence enter my-channel",
    '$ ably channels presence enter my-channel --client-id "client123"',
    '$ ably channels presence enter my-channel --client-id "client123" --data \'{"name":"John","status":"online"}\'',
    "$ ably channels presence enter my-channel --show-others",
    "$ ably channels presence enter my-channel --json",
    "$ ably channels presence enter my-channel --pretty-json",
    "$ ably channels presence enter my-channel --duration 30",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels presence enter my-channel',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    data: Flags.string({
      description: "Optional JSON data to associate with the presence",
    }),
    ...durationFlag,
    "show-others": Flags.boolean({
      default: false,
      description: "Show other presence events while present (default: false)",
    }),
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
  };

  private client: Ably.Realtime | null = null;
  private sequenceCounter = 0;
  private channel: Ably.RealtimeChannel | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPresenceEnter);
    this.validateChannelName(args, flags);

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const { channel: channelName } = args;

      // Parse data if provided
      let data: unknown = undefined;
      if (flags.data) {
        data = this.parseJsonFlag(flags.data, "data", flags);
      }

      this.channel = client.channels.get(channelName);

      // Set up connection state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      // Set up channel state logging
      this.setupChannelStateLogging(this.channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to presence events before entering (if show-others is enabled)
      if (flags["show-others"]) {
        await this.channel.presence.subscribe((presenceMessage) => {
          // Filter out own presence events
          if (presenceMessage.clientId === client.auth.clientId) {
            return;
          }

          this.sequenceCounter++;
          const timestamp = formatMessageTimestamp(presenceMessage.timestamp);
          const event = {
            action: presenceMessage.action,
            channel: channelName,
            clientId: presenceMessage.clientId,
            connectionId: presenceMessage.connectionId,
            data: presenceMessage.data,
            id: presenceMessage.id,
            timestamp,
            ...(flags["sequence-numbers"]
              ? { sequence: this.sequenceCounter }
              : {}),
          };
          this.logCliEvent(
            flags,
            "presence",
            presenceMessage.action!,
            `Presence event: ${presenceMessage.action} by ${presenceMessage.clientId}`,
            event,
          );

          if (this.shouldOutputJson(flags)) {
            this.logJsonEvent({ presenceMessage: event }, flags);
          } else {
            const sequencePrefix = flags["sequence-numbers"]
              ? `${formatIndex(this.sequenceCounter)}`
              : "";
            this.log(
              `${formatTimestamp(timestamp)}${sequencePrefix} ${formatResource(`Channel: ${channelName}`)} | Action: ${formatEventType(String(presenceMessage.action))} | Client: ${formatClientId(presenceMessage.clientId || "N/A")}`,
            );

            if (
              presenceMessage.data !== null &&
              presenceMessage.data !== undefined
            ) {
              if (isJsonData(presenceMessage.data)) {
                this.log(formatLabel("Data"));
                this.log(JSON.stringify(presenceMessage.data, null, 2));
              } else {
                this.log(`${formatLabel("Data")} ${presenceMessage.data}`);
              }
            }

            this.log(""); // Empty line for better readability
          }
        });
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Entering presence on channel: ${formatResource(channelName)}`,
          ),
        );
      }

      // Enter presence
      this.logCliEvent(
        flags,
        "presence",
        "entering",
        `Entering presence on channel ${channelName}`,
        { channel: channelName, clientId: client.auth.clientId, data },
      );

      await this.channel.presence.enter(data);

      this.logCliEvent(
        flags,
        "presence",
        "entered",
        `Entered presence on channel ${channelName}`,
        { channel: channelName, clientId: client.auth.clientId },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            presenceMessage: {
              action: "enter",
              channel: channelName,
              clientId: client.auth.clientId,
              connectionId: client.connection.id,
              data: data ?? null,
              timestamp: new Date().toISOString(),
            },
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Entered presence on channel: ${formatResource(channelName)}.`,
          ),
        );
        this.log(
          `${formatLabel("Client ID")} ${formatClientId(client.auth.clientId)}`,
        );
        this.log(`${formatLabel("Connection ID")} ${client.connection.id}`);
        if (data !== undefined) {
          this.log(`${formatLabel("Data")} ${JSON.stringify(data)}`);
        }
        this.log(
          formatListening(
            flags["show-others"]
              ? "Listening for presence events."
              : "Holding presence.",
          ),
        );
      }

      this.logJsonStatus(
        "holding",
        "Holding presence. Press Ctrl+C to exit.",
        flags,
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "presenceEnter", {
        channel: args.channel,
      });
    }
  }

  async finally(err: Error | undefined): Promise<void> {
    // Leave presence before closing connection
    if (this.channel && this.client) {
      try {
        await Promise.race([
          this.channel.presence.leave(),
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch {
        // Ignore cleanup errors
      }
    }

    await super.finally(err);
  }
}
