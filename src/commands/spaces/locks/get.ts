import type { Lock } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatCountLabel,
  formatHeading,
  formatIndex,
  formatResource,
} from "../../../utils/output.js";
import {
  formatLockBlock,
  formatLockOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesLocksGet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to get locks from",
      required: true,
    }),
    lockId: Args.string({
      description: "Lock ID to get (omit to get all locks)",
      required: false,
    }),
  };

  static override description = "Get a lock or all locks in a space";

  static override examples = [
    "$ ably spaces locks get my-space",
    "$ ably spaces locks get my-space --json",
    "$ ably spaces locks get my-space --pretty-json",
    "$ ably spaces locks get my-space lock-id",
    "$ ably spaces locks get my-space lock-id --json",
    "$ ably spaces locks get my-space lock-id --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksGet);
    const { space_name: spaceName, lockId } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        // The SDK's Locks class stores locks in a Map that starts empty.
        // Entering the space triggers syncing so locks.get()/getAll() return data.
        enterSpace: true,
        setupConnectionLogging: false,
      });

      if (lockId) {
        this.getSingleLock(flags, spaceName, lockId);
      } else {
        await this.getAllLocks(flags, spaceName);
      }
    } catch (error) {
      this.fail(error, flags, "lockGet", { spaceName });
    }
  }

  private getSingleLock(
    flags: Record<string, unknown>,
    spaceName: string,
    lockId: string,
  ): void {
    this.logProgress(
      `Fetching lock ${formatResource(lockId)} from space ${formatResource(spaceName)}`,
      flags,
    );

    const lock = this.space!.locks.get(lockId);

    if (!lock) {
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ lock: null }, flags);
      } else {
        this.logWarning(
          `Lock ${formatResource(lockId)} not found in space ${formatResource(spaceName)}.`,
          flags,
        );
      }

      return;
    }

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult({ lock: formatLockOutput(lock) }, flags);
    } else {
      this.log(formatLockBlock(lock));
    }
  }

  private async getAllLocks(
    flags: Record<string, unknown>,
    spaceName: string,
  ): Promise<void> {
    this.logProgress(
      `Fetching locks for space ${formatResource(spaceName)}`,
      flags,
    );

    const locks: Lock[] = await this.space!.locks.getAll();

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult(
        {
          locks: locks.map((lock) => formatLockOutput(lock)),
        },
        flags,
      );
    } else if (locks.length === 0) {
      this.logWarning("No locks are currently active in this space.", flags);
    } else {
      this.log(
        `\n${formatHeading("Current locks")} (${formatCountLabel(locks.length, "lock")}):\n`,
      );

      for (const [i, lock] of locks.entries()) {
        this.log(`${formatIndex(i + 1)}`);
        this.log(formatLockBlock(lock, { indent: "  " }));
        this.log("");
      }
    }
  }
}
