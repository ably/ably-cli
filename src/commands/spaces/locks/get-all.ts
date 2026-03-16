import type { Lock } from "@ably/spaces";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatCountLabel,
  formatHeading,
  formatIndex,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";
import {
  formatLockBlock,
  formatLockOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesLocksGetAll extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get locks from",
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
    const { space: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      // Get the space
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(`Connecting to space: ${formatResource(spaceName)}`),
        );
      }

      await this.space!.enter();

      // Wait for space to be properly entered before fetching locks
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for space connection"));
        }, 5000);

        const checkSpaceStatus = () => {
          try {
            if (this.realtimeClient!.connection.state === "connected") {
              clearTimeout(timeout);
              if (!this.shouldOutputJson(flags)) {
                this.log(
                  formatSuccess(
                    `Connected to space: ${formatResource(spaceName)}.`,
                  ),
                );
              }

              resolve();
            } else if (
              this.realtimeClient!.connection.state === "failed" ||
              this.realtimeClient!.connection.state === "closed" ||
              this.realtimeClient!.connection.state === "suspended"
            ) {
              clearTimeout(timeout);
              reject(
                new Error(
                  `Space connection failed with connection state: ${this.realtimeClient!.connection.state}`,
                ),
              );
            } else {
              setTimeout(checkSpaceStatus, 100);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        checkSpaceStatus();
      });

      // Get all locks
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
        this.log(chalk.yellow("No locks are currently active in this space."));
      } else {
        this.log(
          `\n${formatHeading("Current locks")} (${formatCountLabel(locks.length, "lock")}):\n`,
        );

        for (let i = 0; i < locks.length; i++) {
          this.log(`${formatIndex(i + 1)} ${formatLockBlock(locks[i])}`);
          this.log("");
        }
      }
    } catch (error) {
      this.fail(error, flags, "lockGetAll", { spaceName });
    }
  }
}
