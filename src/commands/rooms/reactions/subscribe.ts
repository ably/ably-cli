import { ChatClient, RoomReactionEvent } from "@ably/chat";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatClientId,
  formatLabel,
  formatResource,
  formatTimestamp,
} from "../../../utils/output.js";

export default class RoomsReactionsSubscribe extends ChatBaseCommand {
  static override args = {
    roomName: Args.string({
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
        return this.fail(
          "Failed to initialize clients",
          flags,
          "roomReactionSubscribe",
        );
      }

      const { roomName } = args;

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
      this.logProgress(
        `Connecting to Ably and subscribing to reactions in room ${formatResource(roomName)}`,
        flags,
      );

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
      const { failurePromise } = this.setupRoomStatusHandler(room, flags, {
        roomName,
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
        const timestamp = reaction.createdAt.toISOString();
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
          this.logJsonEvent(
            { reaction: { eventType: event.type, ...eventData } },
            flags,
          );
        } else {
          this.log(
            `${formatTimestamp(timestamp)} ${chalk.green("⚡")} ${formatClientId(reaction.clientId)} reacted with ${chalk.yellow(reaction.name || "unknown")}`,
          );

          // Show any additional metadata in the reaction
          if (Object.keys(reaction.metadata).length > 0) {
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

      this.logSuccessMessage(
        `Subscribed to reactions in room: ${formatResource(roomName)}.`,
        flags,
      );
      this.logListening("Listening for reactions.", flags);

      this.logCliEvent(
        flags,
        "reactions",
        "listening",
        "Listening for reactions...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await Promise.race([
        this.waitAndTrackCleanup(flags, "reactions", flags.duration),
        failurePromise,
      ]);
    } catch (error) {
      this.fail(error, flags, "roomReactionSubscribe", { room: args.roomName });
    }
  }
}
