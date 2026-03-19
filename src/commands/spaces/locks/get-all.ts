import type { Lock } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
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
  formatLockBlock,
  formatLockOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesLocksGetAll extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to get locks from",
      required: true,
    }),
  };

  static override description = "Get all current locks in a space";

  static override examples = [
    "$ ably spaces locks get-all my-space",
    "$ ably spaces locks get-all my-space --json",
    "$ ably spaces locks get-all my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksGetAll);
    const { space_name: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching locks for space ${formatResource(spaceName)}`,
          ),
        );
      }

      const locks: Lock[] = await this.space!.locks.getAll();

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            locks: locks.map((lock) => formatLockOutput(lock)),
          },
          flags,
        );
      } else if (locks.length === 0) {
        this.logToStderr(
          formatWarning("No locks are currently active in this space."),
        );
      } else {
        this.log(
          `\n${formatHeading("Current locks")} (${formatCountLabel(locks.length, "lock")}):\n`,
        );

        for (let i = 0; i < locks.length; i++) {
          this.log(`${formatIndex(i + 1)}`);
          this.log(formatLockBlock(locks[i]));
          this.log("");
        }
      }
    } catch (error) {
      this.fail(error, flags, "lockGetAll", { spaceName });
    }
  }
}
