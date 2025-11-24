import { type Space, type LockOptions } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

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
  ];

  static override flags = {
    ...SpacesBaseCommand.globalFlags,
    data: Flags.string({
      description: "Optional data to associate with the lock (JSON format)",
      required: false,
    }),
  };

  private cleanupInProgress = false;
  private realtimeClient: Ably.Realtime | null = null;
  private spacesClient: unknown | null = null;
  private lockId: null | string = null;
  private space: Space | null = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    // Attempt to release lock and leave space if not already done
    if (!this.cleanupInProgress && this.space && this.lockId) {
      // Check if space and lockId are available
      try {
        this.logCliEvent(
          {},
          "lock",
          "finalReleaseAttempt",
          "Attempting final lock release",
          { lockId: this.lockId },
        );
        await this.space.locks.release(this.lockId);
      } catch (error) {
        this.logCliEvent(
          {},
          "lock",
          "finalReleaseError",
          "Error in final lock release",
          {
            error: error instanceof Error ? error.message : String(error),
            lockId: this.lockId,
          },
        );
      }

      try {
        this.logCliEvent(
          {},
          "spaces",
          "finalLeaveAttempt",
          "Attempting final space leave",
        );
        await this.space.leave();
      } catch (error) {
        this.logCliEvent(
          {},
          "spaces",
          "finalLeaveError",
          "Error in final space leave",
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    }

    if (
      this.realtimeClient &&
      this.realtimeClient.connection.state !== "closed" &&
      this.realtimeClient.connection.state !== "failed"
    ) {
      this.realtimeClient.close();
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksAcquire);
    const { space: spaceName } = args;
    this.lockId = args.lockId;
    const { lockId } = this;

    try {
      // Create Spaces client using setupSpacesClient
      const setupResult = await this.setupSpacesClient(flags, spaceName);
      this.realtimeClient = setupResult.realtimeClient;
      this.spacesClient = setupResult.spacesClient;
      this.space = setupResult.space;
      if (!this.realtimeClient || !this.spacesClient || !this.space) {
        this.error("Failed to initialize clients or space");
        return;
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.realtimeClient, flags, {
        includeUserFriendlyMessages: true,
      });

      // Parse lock data if provided
      let lockData: unknown;
      if (flags.data) {
        try {
          lockData = JSON.parse(flags.data);
          this.logCliEvent(
            flags,
            "lock",
            "dataParsed",
            "Lock data parsed successfully",
            { data: lockData },
          );
        } catch (error) {
          const errorMsg = `Invalid lock data JSON: ${error instanceof Error ? error.message : String(error)}`;
          this.logCliEvent(flags, "lock", "dataParseError", errorMsg, {
            error: errorMsg,
          });
          this.error(errorMsg);
          return;
        }
      }

      // Get the space
      this.logCliEvent(
        flags,
        "spaces",
        "gettingSpace",
        `Getting space: ${spaceName}...`,
      );
      this.logCliEvent(
        flags,
        "spaces",
        "gotSpace",
        `Successfully got space handle: ${spaceName}`,
      );

      // Enter the space first
      this.logCliEvent(flags, "spaces", "entering", "Entering space...");
      await this.space.enter();
      this.logCliEvent(
        flags,
        "spaces",
        "entered",
        "Successfully entered space",
        { clientId: this.realtimeClient!.auth.clientId },
      );

      // Try to acquire the lock
      try {
        this.logCliEvent(
          flags,
          "lock",
          "acquiring",
          `Attempting to acquire lock: ${lockId}`,
          { data: lockData, lockId },
        );
        const lock = await this.space.locks.acquire(
          lockId,
          lockData as LockOptions,
        );
        const lockDetails = {
          lockId: lock.id,
          member: lock.member
            ? {
                clientId: lock.member.clientId,
                connectionId: lock.member.connectionId,
              }
            : null,
          reason: lock.reason,
          status: lock.status,
          timestamp: lock.timestamp,
        };
        this.logCliEvent(
          flags,
          "lock",
          "acquired",
          `Successfully acquired lock: ${lockId}`,
          lockDetails,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput({ lock: lockDetails, success: true }, flags),
          );
        } else {
          this.log(
            `${chalk.green("Successfully acquired lock:")} ${chalk.cyan(lockId)}`,
          );
          this.log(
            `${chalk.dim("Lock details:")} ${this.formatJsonOutput(lockDetails, { ...flags, "pretty-json": true })}`,
          );
          this.log(
            `\n${chalk.dim("Holding lock. Press Ctrl+C to release and exit.")}`,
          );
        }
      } catch (error) {
        const errorMsg = `Failed to acquire lock: ${error instanceof Error ? error.message : String(error)}`;
        this.logCliEvent(flags, "lock", "acquireFailed", errorMsg, {
          error: errorMsg,
          lockId,
        });
        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              { error: errorMsg, lockId, success: false },
              flags,
            ),
          );
        } else {
          this.error(errorMsg);
        }

        return; // Exit if lock acquisition fails
      }

      this.logCliEvent(
        flags,
        "lock",
        "holding",
        `Holding lock ${lockId}. Press Ctrl+C to release.`,
      );
      // Decide how long to remain connected
      const effectiveDuration =
        typeof flags.duration === "number"
          ? flags.duration
          : process.env.ABLY_CLI_DEFAULT_DURATION
            ? Number(process.env.ABLY_CLI_DEFAULT_DURATION)
            : undefined;

      await waitUntilInterruptedOrTimeout(effectiveDuration);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
