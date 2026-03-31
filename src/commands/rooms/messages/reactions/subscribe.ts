import {
  ChatClient,
  MessageReactionRawEvent,
  MessageReactionSummaryEvent,
  MessageReactionSummary,
} from "@ably/chat";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../../chat-base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
} from "../../../../flags.js";
import {
  formatClientId,
  formatEventType,
  formatLabel,
  formatResource,
  formatTimestamp,
} from "../../../../utils/output.js";

export default class MessagesReactionsSubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to subscribe to message reactions in",
      required: true,
    }),
  };

  static override description = "Subscribe to message reactions in a chat room";

  static override examples = [
    "$ ably rooms messages reactions subscribe my-room",
    "$ ably rooms messages reactions subscribe my-room --raw",
    "$ ably rooms messages reactions subscribe my-room --json",
    "$ ably rooms messages reactions subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    raw: Flags.boolean({
      description:
        "Subscribe to raw individual reaction events instead of summaries",
      default: false,
    }),
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesReactionsSubscribe);

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        return this.fail(
          "Failed to initialize clients",
          flags,
          "roomMessageReactionSubscribe",
          { room: args.room },
        );
      }

      const { room } = args;

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.logCliEvent(
        flags,
        "subscribe",
        "connecting",
        `Connecting to Ably and subscribing to message reactions in room ${room}...`,
      );
      this.logProgress(
        `Connecting to Ably and subscribing to message reactions in room ${formatResource(room)}`,
        flags,
      );

      // Get the room
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${room}`,
      );

      // Set room options to receive raw reactions if requested
      const roomOptions = flags.raw
        ? {
            messages: {
              rawMessageReactions: true,
            },
          }
        : {};

      const chatRoom = await this.chatClient.rooms.get(room, roomOptions);
      this.logCliEvent(flags, "room", "gotRoom", `Got room handle for ${room}`);

      // Subscribe to room status changes
      const { failurePromise } = this.setupRoomStatusHandler(chatRoom, flags, {
        roomName: room,
      });

      // Attach to the room
      this.logCliEvent(flags, "room", "attaching", `Attaching to room ${room}`);
      await chatRoom.attach();
      // Successful attach logged by onStatusChange handler

      // Subscribe to message reactions based on the flag
      if (flags.raw) {
        // Subscribe to raw reaction events
        this.logCliEvent(
          flags,
          "reactions",
          "subscribingRaw",
          "Subscribing to raw reaction events",
        );
        chatRoom.messages.reactions.subscribeRaw(
          (event: MessageReactionRawEvent) => {
            const timestamp = new Date().toISOString();
            const eventData = {
              eventType: event.type,
              serial: event.reaction.messageSerial,
              reaction: event.reaction,
              room,
              timestamp,
            };
            this.logCliEvent(
              flags,
              "reactions",
              "rawReceived",
              "Raw reaction event received",
              eventData,
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent({ reaction: eventData }, flags);
            } else {
              this.log(
                `${formatTimestamp(timestamp)} ${chalk.green("⚡")} ${formatClientId(event.reaction.clientId)} [${event.reaction.type}] ${event.type}: ${formatEventType(event.reaction.name || "unknown")} to message ${formatResource(event.reaction.messageSerial)}`,
              );
            }
          },
        );
        this.logCliEvent(
          flags,
          "reactions",
          "subscribedRaw",
          "Successfully subscribed to raw reaction events",
        );
      } else {
        // Subscribe to reaction summaries
        this.logCliEvent(
          flags,
          "reactions",
          "subscribing",
          "Subscribing to reaction summaries",
        );
        chatRoom.messages.reactions.subscribe(
          (event: MessageReactionSummaryEvent) => {
            const timestamp = new Date().toISOString();

            // Format the summary for display
            const summaryData: MessageReactionSummary = event.reactions;

            this.logCliEvent(
              flags,
              "reactions",
              "summaryReceived",
              "Reaction summary received",
              {
                room,
                timestamp,
                summary: summaryData,
              },
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(
                {
                  reactionSummary: {
                    eventType: event.type,
                    room,
                    timestamp,
                    summary: summaryData,
                  },
                },
                flags,
              );
            } else {
              this.log(
                `${formatTimestamp(timestamp)} ${chalk.green("📊")} Reaction summary for message ${formatResource(event.messageSerial)}:`,
              );

              // Display the summaries by type if they exist
              if (Object.keys(event.reactions.unique).length > 0) {
                this.log(`  ${formatLabel("Unique reactions")}`);
                this.displayReactionSummary(event.reactions.unique);
              }

              if (Object.keys(event.reactions.distinct).length > 0) {
                this.log(`  ${formatLabel("Distinct reactions")}`);
                this.displayReactionSummary(event.reactions.distinct);
              }

              if (Object.keys(event.reactions.multiple).length > 0) {
                this.log(`  ${formatLabel("Multiple reactions")}`);
                this.displayMultipleReactionSummary(event.reactions.multiple);
              }
            }
          },
        );
        this.logCliEvent(
          flags,
          "reactions",
          "subscribed",
          "Successfully subscribed to reaction summaries",
        );
      }

      this.logSuccessMessage(
        `Subscribed to message reactions in room: ${formatResource(room)}.`,
        flags,
      );
      this.logListening("Listening for message reactions.", flags);

      this.logCliEvent(
        flags,
        "reactions",
        "listening",
        "Listening for message reactions...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await Promise.race([
        this.waitAndTrackCleanup(flags, "reactions", flags.duration),
        failurePromise,
      ]);
    } catch (error) {
      this.fail(error, flags, "roomMessageReactionSubscribe", {
        room: args.room,
      });
    }
  }

  private displayReactionSummary(
    summary: Record<string, { total: number; clientIds: string[] }>,
  ): void {
    for (const [reactionName, details] of Object.entries(summary)) {
      this.log(
        `    ${formatEventType(reactionName)}: ${details.total} (${details.clientIds.join(", ")})`,
      );
    }
  }

  private displayMultipleReactionSummary(
    summary: Record<
      string,
      { total: number; clientIds: Record<string, number> }
    >,
  ): void {
    for (const [reactionName, details] of Object.entries(summary)) {
      const clientList = Object.entries(details.clientIds)
        .map(([clientId, count]) => `${clientId}(${count})`)
        .join(", ");
      this.log(
        `    ${formatEventType(reactionName)}: ${details.total} (${clientList})`,
      );
    }
  }
}
