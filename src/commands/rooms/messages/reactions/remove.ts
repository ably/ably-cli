import { Args, Flags } from "@oclif/core";
import {
  RoomStatus,
  RoomStatusChange,
  MessageReactionType,
  ConnectionStatusChange,
} from "@ably/chat";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../../chat-base-command.js";
import { clientIdFlag, productApiFlags } from "../../../../flags.js";
import { resource, success } from "../../../../utils/output.js";

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
  error?: string;
}

export default class MessagesReactionsRemove extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room where the message is located",
      required: true,
    }),
    messageSerial: Args.string({
      description: "The serial ID of the message to remove reaction from",
      required: true,
    }),
    reaction: Args.string({
      description: "The reaction to remove (e.g. 👍, ❤️, 😂)",
      required: true,
    }),
  };

  static override description =
    "Remove a reaction from a message in a chat room";

  static override examples = [
    "$ ably rooms messages reactions remove my-room message-serial 👍",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms messages reactions remove my-room message-serial ❤️',
    "$ ably rooms messages reactions remove my-room message-serial 👍 --type unique",
    "$ ably rooms messages reactions remove my-room message-serial 👍 --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    type: Flags.string({
      description: "The type of reaction (unique, distinct, or multiple)",
      options: Object.keys(REACTION_TYPE_MAP),
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesReactionsRemove);
    const { room, messageSerial, reaction } = args;

    try {
      // Create Chat client
      const chatClient = await this.createChatClient(flags);

      if (!chatClient) {
        this.error("Failed to create Chat client");
        return;
      }

      // Add listeners for connection state changes
      chatClient.connection.onStatusChange(
        (stateChange: ConnectionStatusChange) => {
          this.logCliEvent(
            flags,
            "connection",
            stateChange.current,
            `Realtime connection state changed to ${stateChange.current}`,
            { error: stateChange.error },
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
      const chatRoom = await chatClient.rooms.get(room);
      this.logCliEvent(flags, "room", "gotRoom", `Got room handle for ${room}`);

      // Subscribe to room status changes
      this.logCliEvent(
        flags,
        "room",
        "subscribingToStatus",
        "Subscribing to room status changes",
      );
      chatRoom.onStatusChange((statusChange: RoomStatusChange) => {
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
      });
      this.logCliEvent(
        flags,
        "room",
        "subscribedToStatus",
        "Successfully subscribed to room status changes",
      );

      // Attach to the room
      this.logCliEvent(flags, "room", "attaching", `Attaching to room ${room}`);
      await chatRoom.attach();
      this.logCliEvent(
        flags,
        "room",
        "attached",
        `Successfully attached to room ${room}`,
      );

      // Remove the reaction
      this.logCliEvent(
        flags,
        "reaction",
        "removing",
        `Removing reaction ${reaction} from message`,
        {
          messageSerial,
          reaction,
          ...(flags.type && { type: flags.type }),
        },
      );

      // Use delete method instead of remove
      await chatRoom.messages.reactions.delete(messageSerial, {
        name: reaction,
        ...(flags.type && { type: REACTION_TYPE_MAP[flags.type] }),
      });

      this.logCliEvent(
        flags,
        "reaction",
        "removed",
        `Successfully removed reaction ${reaction} from message`,
      );

      // Format the response
      const resultData: MessageReactionResult = {
        messageSerial,
        reaction,
        room,
        success: true,
        ...(flags.type && { type: flags.type }),
      };

      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput(resultData, flags));
      } else {
        this.log(
          success(
            `Removed reaction ${chalk.yellow(reaction)} from message ${resource(messageSerial)} in room ${resource(room)}.`,
          ),
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "reaction",
        "error",
        `Failed to remove reaction: ${errorMsg}`,
        { error: errorMsg, room, messageSerial, reaction },
      );

      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: errorMsg,
            room,
            messageSerial,
            reaction,
            ...(flags.type && { type: flags.type }),
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Failed to remove reaction: ${errorMsg}`);
      }
    }
  }
}
