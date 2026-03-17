import { type CursorUpdate } from "@ably/spaces";
import { Args } from "@oclif/core";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatListening,
  formatProgress,
  formatTimestamp,
} from "../../../utils/output.js";
import {
  formatCursorBlock,
  formatCursorOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesCursorsSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to cursors for",
      required: true,
    }),
  };

  static override description = "Subscribe to cursor movements in a space";

  static override examples = [
    "$ ably spaces cursors subscribe my-space",
    "$ ably spaces cursors subscribe my-space --json",
    "$ ably spaces cursors subscribe my-space --pretty-json",
    "$ ably spaces cursors subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private listener: ((update: CursorUpdate) => void) | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCursorsSubscribe);
    const { space: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Subscribing to cursor updates"));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      this.logCliEvent(
        flags,
        "cursor",
        "subscribing",
        "Subscribing to cursor updates",
      );

      try {
        this.listener = (cursorUpdate: CursorUpdate) => {
          try {
            const timestamp = new Date().toISOString();
            this.logCliEvent(
              flags,
              "cursor",
              "updateReceived",
              "Cursor update received",
              {
                clientId: cursorUpdate.clientId,
                position: cursorUpdate.position,
                timestamp,
              },
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(
                { cursor: formatCursorOutput(cursorUpdate) },
                flags,
              );
            } else {
              this.log(formatTimestamp(timestamp));
              this.log(formatCursorBlock(cursorUpdate));
              this.log("");
            }
          } catch (error) {
            this.fail(error, flags, "cursorSubscribe", {
              spaceName,
            });
          }
        };

        await this.waitForCursorsChannelAttachment(flags);
        await this.space!.cursors.subscribe("update", this.listener);

        this.logCliEvent(
          flags,
          "cursor",
          "subscribed",
          "Successfully subscribed to cursor updates",
        );
      } catch (error) {
        this.fail(error, flags, "cursorSubscribe", {
          spaceName,
        });
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(formatListening("Listening for cursor movements."));
      }

      await this.waitAndTrackCleanup(flags, "cursor", flags.duration);
    } catch (error) {
      this.fail(error, flags, "cursorSubscribe", { spaceName });
    }
  }
}
