import { Args, Flags } from "@oclif/core";
import { ChatClient, MessageReactionType } from "@ably/chat";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../../chat-base-command.js";
import { clientIdFlag, productApiFlags } from "../../../../flags.js";
import { formatResource, formatSuccess } from "../../../../utils/output.js";
import { REACTION_TYPE_MAP } from "../../../../utils/chat-constants.js";

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
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms messages reactions send my-room message-serial ❤️',
    "$ ably rooms messages reactions send my-room message-serial 👍 --type multiple --count 10",
    "$ ably rooms messages reactions send my-room message-serial 👍 --type unique",
    "$ ably rooms messages reactions send my-room message-serial 👍 --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    type: Flags.string({
      description: "The type of reaction (unique, distinct, or multiple)",
      options: Object.keys(REACTION_TYPE_MAP),
    }),
    count: Flags.integer({
      description: "Count value for Multiple type reactions",
      dependsOn: ["type"],
    }),
  };

  private chatClient: ChatClient | null = null;

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
        this.fail(
          "Count must be a positive integer for Multiple type reactions",
          flags,
          "roomMessageReactionSend",
          { room, count: flags.count },
        );
      }

      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.fail(
          "Failed to create Chat client",
          flags,
          "roomMessageReactionSend",
          { room },
        );
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags);

      // Get the room
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${room}`,
      );
      const chatRoom = await this.chatClient.rooms.get(room);
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

      await chatRoom.messages.reactions.send(messageSerial, reactionParams);

      this.logCliEvent(
        flags,
        "reaction",
        "sent",
        `Successfully sent reaction ${reaction} to message`,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            messageSerial,
            reaction,
            room,
            ...(flags.type && { reactionType: flags.type }),
            ...(flags.count && { count: flags.count }),
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Sent reaction ${chalk.yellow(reaction)} to message ${formatResource(messageSerial)} in room ${formatResource(room)}.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags, "roomMessageReactionSend", {
        room,
        messageSerial,
        reaction,
        ...(flags.type && { reactionType: flags.type }),
        ...(flags.count && { count: flags.count }),
      });
    }
  }
}
