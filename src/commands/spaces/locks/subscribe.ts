import { type Lock } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatMessageTimestamp,
  formatTimestamp,
} from "../../../utils/output.js";
import {
  formatLockBlock,
  formatLockOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesLocksSubscribe extends SpacesBaseCommand {
  static override args = {
    spaceName: Args.string({
      description: "Name of the space to subscribe to locks for",
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
    const { spaceName } = args;

    try {
      this.logProgress("Subscribing to lock events", flags);

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      this.logCliEvent(
        flags,
        "lock",
        "subscribing",
        "Subscribing to lock events",
      );

      this.listener = (lock: Lock) => {
        this.logCliEvent(flags, "lock", "event-update", "Lock event received", {
          lockId: lock.id,
          status: lock.status,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ lock: formatLockOutput(lock) }, flags);
        } else {
          this.log(formatTimestamp(formatMessageTimestamp(lock.timestamp)));
          this.log(formatLockBlock(lock));
          this.log("");
        }
      };

      this.space!.locks.subscribe(this.listener);

      this.logCliEvent(
        flags,
        "lock",
        "subscribed",
        "Successfully subscribed to lock events",
      );

      this.logListening("Listening for lock events.", flags);

      await this.waitAndTrackCleanup(flags, "lock", flags.duration);
    } catch (error) {
      this.fail(error, flags, "lockSubscribe");
    }
  }
}
