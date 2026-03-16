import { type Lock } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { formatListening, formatTimestamp } from "../../../utils/output.js";
import {
  formatLockBlock,
  formatLockOutput,
} from "../../../utils/spaces-output.js";

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

        this.logCliEvent(flags, "lock", "event-update", "Lock event received", {
          lockId: lock.id,
          status: lock.status,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ lock: formatLockOutput(lock) }, flags);
        } else {
          this.log(formatTimestamp(timestamp));
          this.log(formatLockBlock(lock));
          this.log("");
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
      this.fail(error, flags, "lockSubscribe");
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
