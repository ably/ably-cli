import { type Lock } from "@ably/spaces";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatListening,
  formatProgress,
  formatResource,
  formatTimestamp,
  formatLabel,
} from "../../../utils/output.js";

export default class SpacesLocksSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to locks for",
      required: true,
    }),
  };

  static override description = "Subscribe to lock events in a space";

  static override examples = [
    "$ ably spaces locks subscribe my-space",
    "$ ably spaces locks subscribe my-space --json",
    "$ ably spaces locks subscribe my-space --pretty-json",
    "$ ably spaces locks subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private listener: ((lock: Lock) => void) | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksSubscribe);
    const { space: spaceName } = args;
    this.logCliEvent(
      flags,
      "subscribe.run",
      "start",
      `Starting spaces locks subscribe for space: ${spaceName}`,
    );

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log("Subscribing to lock events");
      }
      this.logCliEvent(
        flags,
        "subscribe.run",
        "initialSignalLogged",
        "Initial readiness signal logged.",
      );

      await this.initializeSpace(flags, spaceName, { enterSpace: true });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(`Connecting to space: ${formatResource(spaceName)}`),
        );
      }

      // Get current locks
      this.logCliEvent(
        flags,
        "lock",
        "gettingInitial",
        "Fetching initial locks",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching current locks for space ${formatResource(spaceName)}`,
          ),
        );
      }

      const locks = await this.space!.locks.getAll();
      this.logCliEvent(
        flags,
        "lock",
        "gotInitial",
        `Fetched ${locks.length} initial locks`,
        { count: locks.length, locks },
      );

      // Output current locks
      if (locks.length === 0) {
        if (!this.shouldOutputJson(flags)) {
          this.log(
            chalk.yellow("No locks are currently active in this space."),
          );
        }
      } else if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              locks: locks.map((lock) => ({
                id: lock.id,
                member: lock.member,
                status: lock.status,
              })),
              spaceName,
              status: "connected",
              success: true,
            },
            flags,
          ),
        );
      } else {
        this.log(
          `\n${chalk.cyan("Current locks")} (${chalk.bold(locks.length.toString())}):\n`,
        );

        for (const lock of locks) {
          this.log(`- Lock ID: ${chalk.blue(lock.id)}`);
          this.log(`  ${formatLabel("Status")} ${lock.status}`);
          this.log(
            `  ${chalk.dim("Member:")} ${lock.member?.clientId || "Unknown"}`,
          );

          if (lock.member?.connectionId) {
            this.log(
              `  ${chalk.dim("Connection ID:")} ${lock.member.connectionId}`,
            );
          }
        }
      }

      // Subscribe to lock events
      this.logCliEvent(
        flags,
        "lock",
        "subscribing",
        "Subscribing to lock events",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(formatListening("Subscribing to lock events."));
      }
      this.logCliEvent(
        flags,
        "lock.subscribe",
        "readySignalLogged",
        "Final readiness signal 'Subscribing to lock events' logged.",
      );

      // Define the listener function
      this.listener = (lock: Lock) => {
        const timestamp = new Date().toISOString();

        const eventData = {
          lock: {
            id: lock.id,
            member: lock.member,
            status: lock.status,
          },
          spaceName,
          timestamp,
          type: "lock_event",
        };

        this.logCliEvent(
          flags,
          "lock",
          "event-update",
          "Lock event received",
          eventData,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput({ success: true, ...eventData }, flags),
          );
        } else {
          this.log(
            `${formatTimestamp(timestamp)} Lock ${chalk.blue(lock.id)} updated`,
          );
          this.log(`  ${formatLabel("Status")} ${lock.status}`);
          this.log(
            `  ${chalk.dim("Member:")} ${lock.member?.clientId || "Unknown"}`,
          );

          if (lock.member?.connectionId) {
            this.log(
              `  ${chalk.dim("Connection ID:")} ${lock.member.connectionId}`,
            );
          }
        }
      };

      // Subscribe using the stored listener
      await this.space!.locks.subscribe(this.listener);

      this.logCliEvent(
        flags,
        "lock",
        "subscribed",
        "Successfully subscribed to lock events",
      );

      this.logCliEvent(
        flags,
        "lock",
        "listening",
        "Listening for lock events...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "lock", flags.duration);
    } catch (error) {
      const errorMsg = `Error during execution: ${errorMessage(error)}`;
      this.logCliEvent(flags, "lock", "executionError", errorMsg, {
        error: errorMsg,
      });
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
