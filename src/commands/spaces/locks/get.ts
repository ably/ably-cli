import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatLabel,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class SpacesLocksGet extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get lock from",
      required: true,
    }),
    lockId: Args.string({
      description: "Lock ID to get",
      required: true,
    }),
  };

  static override description = "Get a lock in a space";

  static override examples = [
    "$ ably spaces locks get my-space my-lock",
    "$ ably spaces locks get my-space my-lock --json",
    "$ ably spaces locks get my-space my-lock --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksGet);
    const { space: spaceName } = args;
    const { lockId } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      await this.space!.enter();
      if (!this.shouldOutputJson(flags)) {
        this.log(formatSuccess(`Entered space: ${formatResource(spaceName)}.`));
      }

      try {
        const lock = await this.space!.locks.get(lockId);

        if (!lock) {
          if (this.shouldOutputJson(flags)) {
            this.logJsonResult({ found: false, lockId }, flags);
          } else {
            this.log(
              chalk.yellow(
                `Lock ${formatResource(lockId)} not found in space ${formatResource(spaceName)}`,
              ),
            );
          }

          return;
        }

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            structuredClone(lock) as Record<string, unknown>,
            flags,
          );
        } else {
          this.log(
            `${formatLabel("Lock details")} ${this.formatJsonOutput(structuredClone(lock), flags)}`,
          );
        }
      } catch (error) {
        this.fail(error, flags, "LockGet");
      }
    } catch (error) {
      this.fail(error, flags, "LockGet");
    }
  }
}
