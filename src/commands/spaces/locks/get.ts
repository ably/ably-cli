import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { resource, success } from "../../../utils/output.js";

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
    this.parsedFlags = flags;

    const { space: spaceName } = args;
    const { lockId } = args;

    try {
      const setupResult = await this.setupSpacesClient(flags, spaceName);
      this.realtimeClient = setupResult.realtimeClient;
      this.space = setupResult.space;
      if (!this.realtimeClient || !this.space) {
        this.error("Failed to initialize clients or space");
        return;
      }

      await this.space.enter();
      if (!this.shouldOutputJson(flags)) {
        this.log(success(`Entered space: ${resource(spaceName)}.`));
      }

      try {
        const lock = await this.space.locks.get(lockId);

        if (!lock) {
          if (this.shouldOutputJson(flags)) {
            this.log(
              this.formatJsonOutput({ error: "Lock not found", lockId }, flags),
            );
          } else {
            this.log(
              chalk.yellow(
                `Lock ${resource(lockId)} not found in space ${resource(spaceName)}`,
              ),
            );
          }

          return;
        }

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(structuredClone(lock), flags));
        } else {
          this.log(
            `${chalk.dim("Lock details:")} ${this.formatJsonOutput(structuredClone(lock), flags)}`,
          );
        }
      } catch (error) {
        this.error(
          `Failed to get lock: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } catch (error) {
      this.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
