import { type CursorUpdate } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatCountLabel,
  formatHeading,
  formatIndex,
  formatProgress,
  formatResource,
  formatWarning,
} from "../../../utils/output.js";
import {
  formatCursorBlock,
  formatCursorOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesCursorsGet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to get cursors from",
      required: true,
    }),
  };

  static override description = "Get all current cursors in a space";

  static override examples = [
    "$ ably spaces cursors get my-space",
    "$ ably spaces cursors get my-space --json",
    "$ ably spaces cursors get my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCursorsGet);
    const { space_name: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching cursors for space ${formatResource(spaceName)}`,
          ),
        );
      }

      const allCursors = await this.space!.cursors.getAll();

      const cursors: CursorUpdate[] = Object.values(allCursors).filter(
        (cursor): cursor is CursorUpdate => cursor != null,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            cursors: cursors.map((cursor) => formatCursorOutput(cursor)),
          },
          flags,
        );
      } else if (cursors.length === 0) {
        this.logToStderr(formatWarning("No active cursors found in space."));
      } else {
        this.log(
          `\n${formatHeading("Current cursors")} (${formatCountLabel(cursors.length, "cursor")}):\n`,
        );

        cursors.forEach((cursor: CursorUpdate, index: number) => {
          this.log(`${formatIndex(index + 1)}`);
          this.log(formatCursorBlock(cursor, { indent: "  " }));
          this.log("");
        });
      }
    } catch (error) {
      this.fail(error, flags, "cursorGet", { spaceName });
    }
  }
}
