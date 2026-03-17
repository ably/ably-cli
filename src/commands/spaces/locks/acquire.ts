import { type LockOptions } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";

import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatSuccess,
  formatListening,
  formatResource,
} from "../../../utils/output.js";
import {
  formatLockBlock,
  formatLockOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesLocksAcquire extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to acquire lock in",
      required: true,
    }),
    lockId: Args.string({
      description: "ID of the lock to acquire",
      required: true,
    }),
  };

  static override description = "Acquire a lock in a space";

  static override examples = [
    "$ ably spaces locks acquire my-space my-lock-id",
    '$ ably spaces locks acquire my-space my-lock-id --data \'{"type":"editor"}\'',
    "$ ably spaces locks acquire my-space my-lock-id --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    data: Flags.string({
      description: "Optional data to associate with the lock (JSON format)",
      required: false,
    }),
    ...durationFlag,
  };

  private lockId: null | string = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    // Attempt to release lock if not already done
    if (this.lockId && this.space) {
      try {
        await this.space.locks.release(this.lockId);
      } catch (error) {
        this.logCliEvent(
          {},
          "lock",
          "finalReleaseError",
          "Error in final lock release",
          {
            error: errorMessage(error),
            lockId: this.lockId,
          },
        );
      }
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksAcquire);
    const { space: spaceName } = args;
    this.lockId = args.lockId;
    const { lockId } = this;

    try {
      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      // Parse lock data if provided
      let lockData: unknown;
      if (flags.data) {
        const parsed = this.parseJsonFlag(flags.data, "lock data", flags);
        lockData = parsed;
        this.logCliEvent(
          flags,
          "lock",
          "dataParsed",
          "Lock data parsed successfully",
          { data: lockData },
        );
      }

      // Enter the space first
      this.logCliEvent(flags, "spaces", "entering", "Entering space...");
      await this.space!.enter();
      this.markAsEntered();
      this.logCliEvent(flags, "spaces", "entered", "Entered space", {
        clientId: this.realtimeClient!.auth.clientId,
      });

      // Try to acquire the lock
      try {
        this.logCliEvent(
          flags,
          "lock",
          "acquiring",
          `Attempting to acquire lock: ${lockId}`,
          { data: lockData, lockId },
        );
        const lock = await this.space!.locks.acquire(
          lockId,
          lockData as LockOptions,
        );
        this.logCliEvent(
          flags,
          "lock",
          "acquired",
          `Lock acquired: ${lockId}`,
          { lockId: lock.id, status: lock.status },
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ locks: [formatLockOutput(lock)] }, flags);
        } else {
          this.log(formatSuccess(`Lock acquired: ${formatResource(lockId)}.`));
          this.log(formatLockBlock(lock));
          this.log(`\n${formatListening("Holding lock.")}`);
        }
      } catch (error) {
        this.fail(error, flags, "lockAcquire", {
          lockId,
        });
      }

      this.logCliEvent(
        flags,
        "lock",
        "holding",
        `Holding lock ${lockId}. Press Ctrl+C to release.`,
      );
      // Decide how long to remain connected
      await this.waitAndTrackCleanup(flags, "locks", flags.duration);
    } catch (error) {
      this.fail(error, flags, "lockAcquire");
    }
  }
}
