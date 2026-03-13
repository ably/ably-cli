import { Args, Flags } from "@oclif/core";
import type { OperationDetails, UpdateMessageParams } from "@ably/chat";

import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import {
  formatProgress,
  formatSuccess,
  formatResource,
} from "../../../utils/output.js";

export default class MessagesUpdate extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room containing the message to update",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to update",
      required: true,
    }),
    text: Args.string({
      description: "The new message text",
      required: true,
    }),
  };

  static override description = "Update a message in an Ably Chat room";

  static override examples = [
    '$ ably rooms messages update my-room "serial-001" "Updated text"',
    '$ ably rooms messages update my-room "serial-001" "Updated text" --description "typo fix"',
    '$ ably rooms messages update my-room "serial-001" "Updated text" --metadata \'{"edited":true}\'',
    '$ ably rooms messages update my-room "serial-001" "Updated text" --headers \'{"source":"cli"}\'',
    '$ ably rooms messages update my-room "serial-001" "Updated text" --json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    description: Flags.string({
      description: "Description of the update operation",
    }),
    headers: Flags.string({
      description: "Additional headers for the message (JSON format)",
    }),
    metadata: Flags.string({
      description: "Additional metadata for the message (JSON format)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesUpdate);

    try {
      // Parse and validate metadata before any client setup
      let metadata;
      if (flags.metadata !== undefined) {
        try {
          metadata = JSON.parse(flags.metadata);
        } catch (error) {
          return this.fail(
            `Invalid metadata JSON: ${errorMessage(error)}`,
            flags,
            "roomMessageUpdate",
          );
        }

        if (
          typeof metadata !== "object" ||
          metadata === null ||
          Array.isArray(metadata)
        ) {
          return this.fail(
            "Metadata must be a JSON object",
            flags,
            "roomMessageUpdate",
          );
        }

        this.logCliEvent(
          flags,
          "roomMessageUpdate",
          "metadataParsed",
          "Message metadata parsed",
          { metadata },
        );
      }

      // Parse and validate headers before any client setup
      let headers;
      if (flags.headers !== undefined) {
        try {
          headers = JSON.parse(flags.headers);
        } catch (error) {
          return this.fail(
            `Invalid headers JSON: ${errorMessage(error)}`,
            flags,
            "roomMessageUpdate",
          );
        }

        if (
          typeof headers !== "object" ||
          headers === null ||
          Array.isArray(headers)
        ) {
          return this.fail(
            "Headers must be a JSON object",
            flags,
            "roomMessageUpdate",
          );
        }

        this.logCliEvent(
          flags,
          "roomMessageUpdate",
          "headersParsed",
          "Message headers parsed",
          { headers },
        );
      }

      const chatClient = await this.createChatClient(flags);

      if (!chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomMessageUpdate",
        );
      }

      this.setupConnectionStateLogging(chatClient.realtime, flags);

      // Get the room and attach
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${args.room}`,
      );
      const room = await chatClient.rooms.get(args.room);
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${args.room}`,
      );

      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${args.room}`,
      );
      await room.attach();
      this.logCliEvent(
        flags,
        "room",
        "attached",
        `Successfully attached to room ${args.room}`,
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            "Updating message " +
              formatResource(args.serial) +
              " in room " +
              formatResource(args.room),
          ),
        );
      }

      // Build update params
      const updateParams: UpdateMessageParams = {
        text: args.text,
        ...(metadata ? { metadata } : {}),
        ...(headers ? { headers } : {}),
      };

      // Build operation details
      const details: OperationDetails | undefined = flags.description
        ? { description: flags.description }
        : undefined;

      this.logCliEvent(
        flags,
        "roomMessageUpdate",
        "updating",
        `Updating message ${args.serial} in room ${args.room}`,
        { room: args.room, serial: args.serial },
      );

      const result = await room.messages.update(
        args.serial,
        updateParams,
        details,
      );

      this.logCliEvent(
        flags,
        "roomMessageUpdate",
        "messageUpdated",
        `Message ${args.serial} updated in room ${args.room}`,
        { room: args.room, serial: args.serial },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            room: args.room,
            serial: args.serial,
            updatedText: result.text,
            versionSerial: result.version.serial,
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Message ${formatResource(args.serial)} updated in room ${formatResource(args.room)}.`,
          ),
        );
        this.log(`  Version serial: ${formatResource(result.version.serial)}`);
      }
    } catch (error) {
      this.fail(error, flags, "roomMessageUpdate", {
        room: args.room,
        serial: args.serial,
      });
    }
  }
}
