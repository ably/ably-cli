import { ChatClient, RoomReactionEvent, RoomStatus } from "@ably/chat";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

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
    ...ChatBaseCommand.globalFlags,
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
  };

  // private clients: ChatClients | null = null; // Replace with chatClient and ablyClient
  private chatClient: ChatClient | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsReactionsSubscribe);

    try {
      // Create Chat client
      // this.clients = await this.createChatClient(flags) // Assign to chatClient
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.error("Failed to initialize clients");
        return;
      }

      // const { chatClient, realtimeClient } = this.clients // Remove deconstruction
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
          `Connecting to Ably and subscribing to reactions in room ${chalk.cyan(roomName)}...`,
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
      this.logCliEvent(
        flags,
        "room",
        "subscribingToStatus",
        "Subscribing to room status changes",
      );
      room.onStatusChange((statusChange) => {
        let reason: Error | null | string | undefined;
        if (statusChange.current === RoomStatus.Failed) {
          reason = room.error; // Get reason from room.error on failure
        }

        const reasonMsg = reason instanceof Error ? reason.message : reason;
        this.logCliEvent(
          flags,
          "room",
          `status-${statusChange.current}`,
          `Room status changed to ${statusChange.current}`,
          { reason: reasonMsg },
        );

        switch (statusChange.current) {
          case RoomStatus.Attached: {
            if (!this.shouldOutputJson(flags)) {
              this.log(chalk.green("Successfully connected to Ably"));
              this.log(
                `Listening for reactions in room ${chalk.cyan(roomName)}. Press Ctrl+C to exit.`,
              );
            }

            break;
          }

          case RoomStatus.Detached: {
            if (!this.shouldOutputJson(flags)) {
              this.log(chalk.yellow("Disconnected from Ably"));
            }

            break;
          }

          case RoomStatus.Failed: {
            if (!this.shouldOutputJson(flags)) {
              this.error(
                `${chalk.red("Connection failed:")} ${reasonMsg || "Unknown error"}`,
              );
            }

            break;
          }
          // No default
        }
      });
      this.logCliEvent(
        flags,
        "room",
        "subscribedToStatus",
        "Successfully subscribed to room status changes",
      );

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
          this.log(
            this.formatJsonOutput({ success: true, ...eventData }, flags),
          );
        } else {
          this.log(
            `[${chalk.dim(timestamp)}] ${chalk.green("⚡")} ${chalk.blue(reaction.clientId || "Unknown")} reacted with ${chalk.yellow(reaction.name || "unknown")}`,
          );

          // Show any additional metadata in the reaction
          if (reaction.metadata && Object.keys(reaction.metadata).length > 0) {
            this.log(
              `  ${chalk.dim("Metadata:")} ${this.formatJsonOutput(reaction.metadata, flags)}`,
            );
          }
        }
      });
      this.logCliEvent(
        flags,
        "reactions",
        "subscribed",
        "Successfully subscribed to reactions",
      );

      this.logCliEvent(
        flags,
        "reactions",
        "listening",
        "Listening for reactions...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(flags, "reactions", "fatalError", `Error: ${errorMsg}`, {
        error: errorMsg,
        room: args.room,
      });
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { error: errorMsg, room: args.room, success: false },
          flags,
        );
      } else {
        this.error(`Error: ${errorMsg}`);
      }
    }
  }
}
