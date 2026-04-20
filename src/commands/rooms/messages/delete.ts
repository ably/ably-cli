import { Args, Flags } from "@oclif/core";
import type { OperationDetails } from "@ably/chat";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { formatResource } from "../../../utils/output.js";

export default class MessagesDelete extends ChatBaseCommand {
  static override args = {
    roomName: Args.string({
      description: "The room containing the message to delete",
      required: true,
    }),
    messageSerial: Args.string({
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
      const chatClient = await this.createChatClient(flags, { restOnly: true });

      if (!chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomMessageDelete",
        );
      }

      const room = await chatClient.rooms.get(args.roomName);

      this.logProgress(
        "Deleting message " +
          formatResource(args.messageSerial) +
          " in room " +
          formatResource(args.roomName),
        flags,
      );

      // Build operation details
      const details: OperationDetails | undefined = flags.description
        ? { description: flags.description }
        : undefined;

      this.logCliEvent(
        flags,
        "roomMessageDelete",
        "deleting",
        `Deleting message ${args.messageSerial} from room ${args.roomName}`,
        { room: args.roomName, serial: args.messageSerial },
      );

      const result = await room.messages.delete(args.messageSerial, details);

      this.logCliEvent(
        flags,
        "roomMessageDelete",
        "messageDeleted",
        `Message ${args.messageSerial} deleted from room ${args.roomName}`,
        { room: args.roomName, serial: args.messageSerial },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            message: {
              room: args.roomName,
              serial: args.messageSerial,
              versionSerial: result.version.serial,
            },
          },
          flags,
        );
      } else {
        this.log(`  Version serial: ${formatResource(result.version.serial)}`);
      }

      this.logSuccessMessage(
        `Message ${formatResource(args.messageSerial)} deleted from room ${formatResource(args.roomName)}.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "roomMessageDelete", {
        room: args.roomName,
        serial: args.messageSerial,
      });
    }
  }
}
