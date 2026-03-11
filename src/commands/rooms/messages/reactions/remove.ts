import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../../chat-base-command.js";
import { clientIdFlag, productApiFlags } from "../../../../flags.js";
import { formatResource, formatSuccess } from "../../../../utils/output.js";
import { REACTION_TYPE_MAP } from "../../../../utils/chat-constants.js";

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
        this.fail(
          "Failed to create Chat client",
          flags,
          "roomMessageReactionRemove",
          { room },
        );
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(chatClient.realtime, flags);

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
      this.setupRoomStatusHandler(chatRoom, flags, { roomName: room });

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

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            messageSerial,
            reaction,
            room,
            ...(flags.type && { reactionType: flags.type }),
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Removed reaction ${chalk.yellow(reaction)} from message ${formatResource(messageSerial)} in room ${formatResource(room)}.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags, "roomMessageReactionRemove", {
        room,
        messageSerial,
        reaction,
      });
    }
  }
}
