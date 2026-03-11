import { ChatClient, RoomReactionEvent } from "@ably/chat";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatClientId,
  formatProgress,
  formatResource,
  formatTimestamp,
  formatLabel,
} from "../../../utils/output.js";

export default class RoomsReactionsSubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to subscribe to reactions in",
      required: true,
    }),
  };

  static override description = "Subscribe to reactions in a chat room";

  static override examples = [
    "$ ably rooms reactions subscribe my-room",
    "$ ably rooms reactions subscribe my-room --json",
    "$ ably rooms reactions subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsReactionsSubscribe);

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.fail(
          new Error("Failed to initialize clients"),
          flags,
          "RoomReactionSubscribe",
        );
      }

      const { room: roomName } = args;

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.logCliEvent(
        flags,
        "subscribe",
        "connecting",
        `Connecting to Ably and subscribing to reactions in room ${roomName}...`,
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Connecting to Ably and subscribing to reactions in room ${formatResource(roomName)}`,
          ),
        );
      }

      // Get the room
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${roomName}`,
      );
      const room = await this.chatClient.rooms.get(roomName);
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${roomName}`,
      );

      // Subscribe to room status changes
      this.setupRoomStatusHandler(room, flags, {
        roomName,
        successMessage: `Subscribed to reactions in room: ${formatResource(roomName)}.`,
        listeningMessage: "Listening for reactions.",
      });

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${roomName}`,
      );
      await room.attach();
      // Successful attach logged by onStatusChange handler

      // Subscribe to room reactions
      this.logCliEvent(
        flags,
        "reactions",
        "subscribing",
        "Subscribing to reactions",
      );
      room.reactions.subscribe((event: RoomReactionEvent) => {
        const reaction = event.reaction;
        const timestamp = new Date().toISOString(); // Chat SDK doesn't provide timestamp in event
        const eventData = {
          clientId: reaction.clientId,
          metadata: reaction.metadata,
          room: roomName,
          timestamp,
          name: reaction.name,
        };
        this.logCliEvent(
          flags,
          "reactions",
          "received",
          "Reaction received",
          eventData,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ eventType: event.type, ...eventData }, flags);
        } else {
          this.log(
            `${formatTimestamp(timestamp)} ${chalk.green("⚡")} ${formatClientId(reaction.clientId || "Unknown")} reacted with ${chalk.yellow(reaction.name || "unknown")}`,
          );

          // Show any additional metadata in the reaction
          if (reaction.metadata && Object.keys(reaction.metadata).length > 0) {
            this.log(
              `  ${formatLabel("Metadata")} ${this.formatJsonOutput(reaction.metadata, flags)}`,
            );
          }
        }
      });
      this.logCliEvent(
        flags,
        "reactions",
        "subscribed",
        "Subscribed to reactions",
      );

      this.logCliEvent(
        flags,
        "reactions",
        "listening",
        "Listening for reactions...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "reactions", flags.duration);
    } catch (error) {
      this.fail(error, flags, "RoomReactionSubscribe", { room: args.room });
    }
  }
}
