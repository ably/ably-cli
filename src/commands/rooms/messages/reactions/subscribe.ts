import { ChatClient, RoomStatus, Subscription, MessageReactionRawEvent, MessageReactionSummaryEvent, MessageReactionSummary } from "@ably/chat";
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../../chat-base-command.js";

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
    ...ChatBaseCommand.globalFlags,
    raw: Flags.boolean({
      description: "Subscribe to raw individual reaction events instead of summaries",
      default: false,
    }),
  };

  private chatClient: ChatClient | null = null;
  private ablyClient: Ably.Realtime | null = null;
  private unsubscribeReactionsFn: Subscription | null = null;
  private unsubscribeRawReactionsFn: Subscription | null = null;
  private unsubscribeStatusFn: (() => void) | null = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    if (this.unsubscribeReactionsFn) {
      try {
        this.unsubscribeReactionsFn.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    if (this.unsubscribeRawReactionsFn) {
      try {
        this.unsubscribeRawReactionsFn.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    if (this.unsubscribeStatusFn) {
      try {
        this.unsubscribeStatusFn();
      } catch {
        /* ignore */
      }
    }
    if (
      this.ablyClient &&
      this.ablyClient.connection.state !== "closed" &&
      this.ablyClient.connection.state !== "failed"
    ) {
      this.ablyClient.close();
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesReactionsSubscribe);

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags);
      this.ablyClient = this._chatRealtimeClient;
      
      if (!this.chatClient || !this.ablyClient) {
        this.error("Failed to initialize clients");
        return;
      }

      const { room } = args;

      // Set up connection state logging
      this.setupConnectionStateLogging(this.ablyClient, flags, {
        includeUserFriendlyMessages: true
      });

      this.logCliEvent(
        flags,
        "subscribe",
        "connecting",
        `Connecting to Ably and subscribing to message reactions in room ${room}...`,
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          `Connecting to Ably and subscribing to message reactions in room ${chalk.cyan(room)}...`,
        );
      }

      // Get the room
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${room}`,
      );
      
      // Set room options to receive raw reactions if requested
      const roomOptions = flags.raw ? {
        messages: {
          rawMessageReactions: true,
        },
      } : {};
      
      const chatRoom = await this.chatClient.rooms.get(room, roomOptions);
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${room}`,
      );

      // Subscribe to room status changes
      this.logCliEvent(
        flags,
        "room",
        "subscribingToStatus",
        "Subscribing to room status changes",
      );
      const { off: unsubscribeStatus } = chatRoom.onStatusChange((statusChange) => {
        let reason: Error | null | string | undefined;
        if (statusChange.current === RoomStatus.Failed) {
          reason = chatRoom.error; // Get reason from chatRoom.error on failure
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
                `Listening for message reactions in room ${chalk.cyan(room)}. Press Ctrl+C to exit.`,
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
      this.unsubscribeStatusFn = unsubscribeStatus;
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
        `Attaching to room ${room}`,
      );
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
        this.unsubscribeRawReactionsFn = chatRoom.messages.reactions.subscribeRaw((event: MessageReactionRawEvent) => {
          const timestamp = new Date().toISOString();
          const eventData = {
            type: event.type,
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
            this.log(
              this.formatJsonOutput({ success: true, ...eventData }, flags),
            );
          } else {
            this.log(
              `[${chalk.dim(timestamp)}] ${chalk.green("⚡")} ${chalk.blue(event.reaction.clientId || "Unknown")} [${event.reaction.type}] ${event.type}: ${chalk.yellow(event.reaction.name || "unknown")} to message ${chalk.cyan(event.reaction.messageSerial)}`,
            );
          }
        });
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
        this.unsubscribeReactionsFn = chatRoom.messages.reactions.subscribe((event: MessageReactionSummaryEvent) => {
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
            }
          );

          if (this.shouldOutputJson(flags)) {
            this.log(
              this.formatJsonOutput({
                success: true,
                room,
                timestamp,
                summary: summaryData
              }, flags),
            );
          } else {
            this.log(
              `[${chalk.dim(timestamp)}] ${chalk.green("📊")} Reaction summary for message ${chalk.cyan(event.messageSerial)}:`,
            );

            // Display the summaries by type if they exist
            if (event.reactions.unique && Object.keys(event.reactions.unique).length > 0) {
              this.log(`  ${chalk.blue("Unique reactions:")}`);
              this.displayReactionSummary(event.reactions.unique, flags);
            }
            
            if (event.reactions.distinct && Object.keys(event.reactions.distinct).length > 0) {
              this.log(`  ${chalk.blue("Distinct reactions:")}`);
              this.displayReactionSummary(event.reactions.distinct, flags);
            }
            
            if (event.reactions.multiple && Object.keys(event.reactions.multiple).length > 0) {
              this.log(`  ${chalk.blue("Multiple reactions:")}`);
              this.displayMultipleReactionSummary(event.reactions.multiple, flags);
            }
          }
        });
        this.logCliEvent(
          flags,
          "reactions",
          "subscribed",
          "Successfully subscribed to reaction summaries",
        );
      }

      this.logCliEvent(
        flags,
        "reactions",
        "listening",
        "Listening for message reactions...",
      );
      
      // Keep the process running until interrupted
      await new Promise<void>((resolve) => {
        let cleanupInProgress = false;
        const cleanup = async () => {
          if (cleanupInProgress) return;
          cleanupInProgress = true;
          this.logCliEvent(
            flags,
            "reactions",
            "cleanupInitiated",
            "Cleanup initiated (Ctrl+C pressed)",
          );
          if (!this.shouldOutputJson(flags)) {
            this.log(
              `\n${chalk.yellow("Unsubscribing and closing connection...")}`,
            );
          }

          // Set a force exit timeout
          const forceExitTimeout = setTimeout(() => {
            const errorMsg = "Force exiting after timeout during cleanup";
            this.logCliEvent(flags, "reactions", "forceExit", errorMsg, {
              room,
            });
            if (!this.shouldOutputJson(flags)) {
              this.log(chalk.red("Force exiting after timeout..."));
            }
          }, 5000);

          // Unsubscribe from reactions
          if (this.unsubscribeReactionsFn) {
            try {
              this.logCliEvent(
                flags,
                "reactions",
                "unsubscribing",
                "Unsubscribing from reaction summaries",
              );
              this.unsubscribeReactionsFn.unsubscribe();
              this.logCliEvent(
                flags,
                "reactions",
                "unsubscribed",
                "Unsubscribed from reaction summaries",
              );
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              this.logCliEvent(
                flags,
                "reactions",
                "unsubscribeError",
                `Error unsubscribing from reactions: ${errorMsg}`,
                { error: errorMsg },
              );
            }
          }

          // Unsubscribe from raw reactions
          if (this.unsubscribeRawReactionsFn) {
            try {
              this.logCliEvent(
                flags,
                "reactions",
                "unsubscribingRaw",
                "Unsubscribing from raw reaction events",
              );
              this.unsubscribeRawReactionsFn.unsubscribe();
              this.logCliEvent(
                flags,
                "reactions",
                "unsubscribedRaw",
                "Unsubscribed from raw reaction events",
              );
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              this.logCliEvent(
                flags,
                "reactions",
                "unsubscribeRawError",
                `Error unsubscribing from raw reactions: ${errorMsg}`,
                { error: errorMsg },
              );
            }
          }

          // Unsubscribe from status changes
          if (this.unsubscribeStatusFn) {
            try {
              this.logCliEvent(
                flags,
                "room",
                "unsubscribingStatus",
                "Unsubscribing from room status",
              );
              this.unsubscribeStatusFn();
              this.logCliEvent(
                flags,
                "room",
                "unsubscribedStatus",
                "Unsubscribed from room status",
              );
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              this.logCliEvent(
                flags,
                "room",
                "unsubscribeStatusError",
                `Error unsubscribing from status: ${errorMsg}`,
                { error: errorMsg },
              );
            }
          }

          try {
            this.logCliEvent(
              flags,
              "room",
              "releasing",
              `Releasing room ${room}`,
            );
            if (this.chatClient) {
              await this.chatClient.rooms.release(room);
              this.logCliEvent(
                flags,
                "room",
                "released",
                `Room ${room} released`,
              );
            } else {
              this.logCliEvent(
                flags,
                "room",
                "releaseError",
                "Chat client was null during cleanup",
                { error: "Chat client null" },
              );
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            this.logCliEvent(
              flags,
              "room",
              "releaseError",
              `Error releasing room: ${errorMsg}`,
              { error: errorMsg },
            );
            if (this.shouldOutputJson(flags)) {
              this.log(
                this.formatJsonOutput(
                  { error: errorMsg, room, success: false },
                  flags,
                ),
              );
            } else {
              this.log(`Error releasing room: ${errorMsg}`);
            }
          }

          if (this.ablyClient) {
            this.logCliEvent(
              flags,
              "connection",
              "closing",
              "Closing Realtime connection",
            );
            this.ablyClient.close();
            this.logCliEvent(
              flags,
              "connection",
              "closed",
              "Realtime connection closed",
            );
          }

          if (!this.shouldOutputJson(flags)) {
            this.log(chalk.green("Successfully disconnected."));
          }

          clearTimeout(forceExitTimeout);
          resolve();
        };

        process.on("SIGINT", () => void cleanup());
        process.on("SIGTERM", () => void cleanup());
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(flags, "reactions", "fatalError", `Error: ${errorMsg}`, {
        error: errorMsg,
        room: args.room,
      });
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            { error: errorMsg, room: args.room, success: false },
            flags,
          ),
        );
      } else {
        this.error(`Error: ${errorMsg}`);
      }
    } finally {
      // Ensure client is closed even if cleanup promise didn't resolve
      if (
        this.ablyClient &&
        this.ablyClient.connection.state !== "closed" &&
        this.ablyClient.connection.state !== "failed"
      ) {
        this.logCliEvent(
          flags || {},
          "connection",
          "finalCloseAttempt",
          "Ensuring connection is closed in finally block.",
        );
        this.ablyClient.close();
      }
    }
  }

  private displayReactionSummary(
    summary: Record<string, { total: number; clientIds: string[] }>,
    _flags: { json?: boolean; 'pretty-json'?: boolean }
  ): void {
    for (const [reactionName, details] of Object.entries(summary)) {
      this.log(`    ${chalk.yellow(reactionName)}: ${details.total} (${details.clientIds.join(', ')})`);
    }
  }

  private displayMultipleReactionSummary(
    summary: Record<string, { total: number; clientIds: Record<string, number> }>,
    _flags: { json?: boolean; 'pretty-json'?: boolean }
  ): void {
    for (const [reactionName, details] of Object.entries(summary)) {
      const clientList = Object.entries(details.clientIds)
        .map(([clientId, count]) => `${clientId}(${count})`)
        .join(', ');
      this.log(`    ${chalk.yellow(reactionName)}: ${details.total} (${clientList})`);
    }
  }
}
