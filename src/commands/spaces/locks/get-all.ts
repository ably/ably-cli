import { Args } from "@oclif/core";
import chalk from "chalk";

import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatHeading,
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

interface LockItem {
  attributes?: Record<string, unknown>;
  id: string;
  member?: {
    clientId?: string;
  };
  status?: string;
}

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

      let locks: LockItem[] = [];
      const result = await this.space!.locks.getAll();
      locks = Array.isArray(result) ? result : [];

      const validLocks = locks.filter((lock: LockItem) => {
        if (!lock || !lock.id) return false;
        return true;
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            locks: validLocks.map((lock) => ({
              attributes: lock.attributes || {},
              holder: lock.member?.clientId || null,
              id: lock.id,
              status: lock.status || "unknown",
            })),
            spaceName,
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      } else if (!validLocks || validLocks.length === 0) {
        this.log(chalk.yellow("No locks are currently active in this space."));
      } else {
        const lockCount = validLocks.length;
        this.log(
          `\n${formatHeading("Current locks")} (${chalk.bold(String(lockCount))}):\n`,
        );

        validLocks.forEach((lock: LockItem) => {
          try {
            this.log(`- ${formatResource(lock.id)}:`);
            this.log(`  ${formatLabel("Status")} ${lock.status || "unknown"}`);
            this.log(
              `  ${formatLabel("Holder")} ${lock.member?.clientId || "None"}`,
            );

            if (lock.attributes && Object.keys(lock.attributes).length > 0) {
              this.log(
                `  ${formatLabel("Attributes")} ${JSON.stringify(lock.attributes, null, 2)}`,
              );
            }
          } catch (error) {
            this.log(
              `- ${chalk.red("Error displaying lock item")}: ${errorMessage(error)}`,
            );
          }
        });
      }
    } catch (error) {
      this.fail(error, flags, "lockGetAll", { spaceName });
    }
  }
}
