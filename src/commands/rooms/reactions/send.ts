import { ChatClient, JsonObject } from "@ably/chat";
import { Args, Flags } from "@oclif/core";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { errorMessage } from "../../../utils/errors.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import { formatResource, formatSuccess } from "../../../utils/output.js";

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
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms reactions send my-room 🎉',
    "$ ably rooms reactions send my-room ❤️ --json",
    "$ ably rooms reactions send my-room 😂 --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    metadata: Flags.string({
      description:
        "Additional metadata to send with the reaction (as JSON string)",
      required: false,
    }),
  };

  private chatClient: ChatClient | null = null;
  private metadataObj: JsonObject | null = null;

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
          this.fail(
            `Invalid metadata JSON: ${errorMessage(error)}`,
            flags,
            "roomReactionSend",
            { room: roomName },
          );
        }
      }

      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomReactionSend",
          {
            room: roomName,
          },
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
      const { failurePromise } = this.setupRoomStatusHandler(room, flags, {
        roomName,
      });
      failurePromise.catch(() => {}); // one-shot command; attach() handles failure

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

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { reaction: { emoji, metadata: this.metadataObj, room: roomName } },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Sent reaction ${emoji} in room ${formatResource(roomName)}.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags, "roomReactionSend", {
        room: roomName,
        emoji,
      });
    }
  }
}
