import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import {
  ChatClient,
  RoomStatus,
  RoomStatusChange,
  MessageReactionType,
} from "@ably/chat";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../../chat-base-command.js";

// Map CLI-friendly type names to SDK MessageReactionType values
const REACTION_TYPE_MAP: Record<string, MessageReactionType> = {
  unique: MessageReactionType.Unique,
  distinct: MessageReactionType.Distinct,
  multiple: MessageReactionType.Multiple,
};

interface MessageReactionResult {
  [key: string]: unknown;
  success: boolean;
  room: string;
  messageSerial?: string;
  reaction?: string;
  type?: string;
  count?: number;
  error?: string;
}

export default class MessagesReactionsSend extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room where the message is located",
      required: true,
    }),
    messageSerial: Args.string({
      description: "The serial ID of the message to react to",
      required: true,
    }),
    reaction: Args.string({
      description: "The reaction to send (e.g. 👍, ❤️, 😂)",
      required: true,
    }),
  };

  static override description = "Send a reaction to a message in a chat room";

  static override examples = [
    "$ ably rooms messages reactions send my-room message-serial 👍",
    '$ ably rooms messages reactions send --api-key "YOUR_API_KEY" my-room message-serial ❤️',
    "$ ably rooms messages reactions send my-room message-serial 👍 --type multiple --count 10",
    "$ ably rooms messages reactions send my-room message-serial 👍 --type unique",
    "$ ably rooms messages reactions send my-room message-serial 👍 --json",
  ];

  static override flags = {
    ...ChatBaseCommand.globalFlags,
    type: Flags.string({
      description: "The type of reaction (unique, distinct, or multiple)",
      options: Object.keys(REACTION_TYPE_MAP),
    }),
    count: Flags.integer({
      description: "Count value for Multiple type reactions",
      dependsOn: ["type"],
    }),
  };

  private ablyClient: Ably.Realtime | null = null;
  private chatClient: ChatClient | null = null;
  private unsubscribeStatusFn: (() => void) | null = null;

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
    const { args, flags } = await this.parse(MessagesReactionsSend);
    const { room, messageSerial, reaction } = args;

    try {
      // Validate count for Multiple type
      if (
        flags.type === "multiple" &&
        flags.count !== undefined &&
        flags.count <= 0
      ) {
        const errorMsg =
          "Count must be a positive integer for Multiple type reactions";
        this.logCliEvent(flags, "reaction", "invalidCount", errorMsg, {
          error: errorMsg,
          count: flags.count,
        });
        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              { error: errorMsg, room, success: false },
              flags,
            ),
          );
        } else {
          this.error(errorMsg);
        }
        return;
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
        `Getting room handle for ${room}`,
      );
      const chatRoom = await this.chatClient.rooms.get(room);
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
      const { off: unsubscribeStatus } = chatRoom.onStatusChange(
        (statusChange: RoomStatusChange) => {
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
        `Attaching to room ${room}`,
      );
      await chatRoom.attach();
      this.logCliEvent(
        flags,
        "room",
        "attached",
        `Successfully attached to room ${room}`,
      );

      // Prepare the reaction parameters
      const reactionParams: {
        name: string;
        type?: MessageReactionType;
        count?: number;
      } = {
        name: reaction,
      };

      // Set optional parameters if provided
      if (flags.type) {
        reactionParams.type = REACTION_TYPE_MAP[flags.type];
      }
      if (flags.type === "multiple" && flags.count) {
        reactionParams.count = flags.count;
      }

      // Send the reaction
      this.logCliEvent(
        flags,
        "reaction",
        "sending",
        `Sending reaction ${reaction} to message`,
        {
          messageSerial,
          reaction: reactionParams,
        },
      );

      await chatRoom.messages.reactions.send(
        { serial: messageSerial },
        reactionParams,
      );

      this.logCliEvent(
        flags,
        "reaction",
        "sent",
        `Successfully sent reaction ${reaction} to message`,
      );

      // Format the response
      const resultData: MessageReactionResult = {
        messageSerial,
        reaction,
        room,
        success: true,
        ...(flags.type && { type: flags.type }),
        ...(flags.count && { count: flags.count }),
      };

      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput(resultData, flags));
      } else {
        this.log(
          `${chalk.green("✓")} Sent reaction ${chalk.yellow(reaction)} to message ${chalk.cyan(messageSerial)} in room ${chalk.cyan(room)}`,
        );
      }

      // Clean up resources
      this.logCliEvent(flags, "room", "releasing", `Releasing room ${room}`);
      await this.chatClient.rooms.release(room);
      this.logCliEvent(flags, "room", "released", `Released room ${room}`);

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
        { error: errorMsg, room, messageSerial, reaction },
      );

      // Close the connection in case of error
      if (this.ablyClient) {
        this.ablyClient.close();
      }

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error: errorMsg,
              room,
              messageSerial,
              reaction,
              success: false,
              ...(flags.type && { type: flags.type }),
              ...(flags.count && { count: flags.count }),
            },
            flags,
          ),
        );
      } else {
        this.error(`Failed to send reaction: ${errorMsg}`);
      }
    }
  }
}
