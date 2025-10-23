import { RoomStatus, ChatClient, RoomStatusChange, JsonObject } from "@ably/chat";
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";

export default class RoomsReactionsSend extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room to send the reaction to",
      required: true,
    }),
    emoji: Args.string({
      description: "The emoji reaction to send (e.g. 👍, ❤️, 😂)",
      required: true,
    }),
  };

  static override description = "Send a reaction in a chat room";

  static override examples = [
    "$ ably rooms reactions send my-room 👍",
    '$ ably rooms reactions send --api-key "YOUR_API_KEY" my-room 🎉',
    "$ ably rooms reactions send my-room ❤️ --json",
    "$ ably rooms reactions send my-room 😂 --pretty-json",
  ];

  static override flags = {
    ...ChatBaseCommand.globalFlags,
    metadata: Flags.string({
      description:
        "Additional metadata to send with the reaction (as JSON string)",
      required: false,
    }),
  };

  private ablyClient: Ably.Realtime | null = null;
  private chatClient: ChatClient | null = null;
  private unsubscribeStatusFn: (() => void) | null = null;
  private metadataObj: JsonObject | null = null;

  async finally(err: Error | undefined): Promise<void> {
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
    const { args, flags } = await this.parse(RoomsReactionsSend);
    const { room: roomName, emoji } = args;

    try {
      // Parse metadata if provided
      if (flags.metadata) {
        try {
          this.metadataObj = JSON.parse(flags.metadata);
          this.logCliEvent(
            flags,
            "reaction",
            "metadataParsed",
            "Metadata parsed successfully",
            { metadata: this.metadataObj },
          );
        } catch (error) {
          const errorMsg = `Invalid metadata JSON: ${error instanceof Error ? error.message : String(error)}`;
          this.logCliEvent(flags, "reaction", "metadataParseError", errorMsg, {
            error: errorMsg,
            room: roomName,
          });
          if (this.shouldOutputJson(flags)) {
            this.log(
              this.formatJsonOutput(
                { error: errorMsg, room: roomName, success: false },
                flags,
              ),
            );
          } else {
            this.error(errorMsg);
          }

          return;
        }
      }

      // Create Chat client
      this.chatClient = await this.createChatClient(flags);
      // Get the underlying Ably client for connection state changes
      this.ablyClient = this._chatRealtimeClient;

      if (!this.chatClient) {
        this.error("Failed to create Chat client");
        return;
      }
      if (!this.ablyClient) {
        this.error("Failed to create Ably client");
        return;
      }

      // Add listeners for connection state changes
      this.ablyClient.connection.on(
        (stateChange: Ably.ConnectionStateChange) => {
          this.logCliEvent(
            flags,
            "connection",
            stateChange.current,
            `Realtime connection state changed to ${stateChange.current}`,
            { reason: stateChange.reason },
          );
        },
      );

      // Get the room
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${roomName}`,
      );
      const room = await this.chatClient.rooms.get(roomName, {});
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
      const { off: unsubscribeStatus } = room.onStatusChange(
        (statusChange: RoomStatusChange) => {
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

          if (
            statusChange.current === RoomStatus.Failed &&
            !this.shouldOutputJson(flags)
          ) {
            this.error(
              `Failed to attach to room: ${reasonMsg || "Unknown error"}`,
            );
          }
        },
      );
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
        `Attaching to room ${roomName}`,
      );
      await room.attach();
      this.logCliEvent(
        flags,
        "room",
        "attached",
        `Successfully attached to room ${roomName}`,
      );

      // Send the reaction
      this.logCliEvent(
        flags,
        "reaction",
        "sending",
        `Sending reaction ${emoji}`,
        { emoji, metadata: this.metadataObj || {} },
      );
      await room.reactions.send({
        name: emoji,
        metadata: this.metadataObj || {},
      });
      this.logCliEvent(
        flags,
        "reaction",
        "sent",
        `Successfully sent reaction ${emoji}`,
      );

      // Format the response
      const resultData = {
        emoji,
        metadata: this.metadataObj,
        room: roomName,
        success: true,
      };

      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput(resultData, flags));
      } else {
        this.log(
          `${chalk.green("✓")} Sent reaction ${emoji} in room ${chalk.cyan(roomName)}`,
        );
      }

      // Clean up resources
      this.logCliEvent(flags, "room", "releasing", `Releasing room ${roomName}`);
      await this.chatClient.rooms.release(roomName);
      this.logCliEvent(flags, "room", "released", `Released room ${roomName}`);

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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "reaction",
        "error",
        `Failed to send reaction: ${errorMsg}`,
        { error: errorMsg, room: roomName, emoji },
      );

      // Close the connection in case of error
      if (this.ablyClient) {
        this.ablyClient.close();
      }

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            { error: errorMsg, room: roomName, emoji, success: false },
            flags,
          ),
        );
      } else {
        this.error(`Failed to send reaction: ${errorMsg}`);
      }
    }
  }
}
