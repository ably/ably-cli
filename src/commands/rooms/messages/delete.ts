import { Args, Flags } from "@oclif/core";
import type { OperationDetails } from "@ably/chat";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import {
  formatProgress,
  formatSuccess,
  formatResource,
} from "../../../utils/output.js";

export default class MessagesDelete extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room containing the message to delete",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to delete",
      required: true,
    }),
  };

  static override description = "Delete a message in an Ably Chat room";

  static override examples = [
    '$ ably rooms messages delete my-room "serial-001"',
    '$ ably rooms messages delete my-room "serial-001" --description "spam removal"',
    '$ ably rooms messages delete my-room "serial-001" --json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    description: Flags.string({
      description: "Description of the delete operation",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesDelete);

    try {
      const chatClient = await this.createChatClient(flags);

      if (!chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomMessageDelete",
        );
      }

      this.setupConnectionStateLogging(chatClient.realtime, flags);

      const room = await chatClient.rooms.get(args.room);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            "Deleting message " +
              formatResource(args.serial) +
              " in room " +
              formatResource(args.room),
          ),
        );
      }

      // Build operation details
      const details: OperationDetails | undefined = flags.description
        ? { description: flags.description }
        : undefined;

      this.logCliEvent(
        flags,
        "roomMessageDelete",
        "deleting",
        `Deleting message ${args.serial} from room ${args.room}`,
        { room: args.room, serial: args.serial },
      );

      const result = await room.messages.delete(args.serial, details);

      this.logCliEvent(
        flags,
        "roomMessageDelete",
        "messageDeleted",
        `Message ${args.serial} deleted from room ${args.room}`,
        { room: args.room, serial: args.serial },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            room: args.room,
            serial: args.serial,
            versionSerial: result.version.serial,
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Message ${formatResource(args.serial)} deleted from room ${formatResource(args.room)}.`,
          ),
        );
        this.log(`  Version serial: ${formatResource(result.version.serial)}`);
      }
    } catch (error) {
      this.fail(error, flags, "roomMessageDelete", {
        room: args.room,
        serial: args.serial,
      });
    }
  }
}
