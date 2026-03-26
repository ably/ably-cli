import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import { JsonStatusType } from "../../utils/json-status.js";
import {
  formatCountLabel,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
} from "../../utils/output.js";
import {
  formatMemberBlock,
  formatMemberOutput,
} from "../../utils/spaces-output.js";

export default class SpacesSubscribe extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to subscribe to",
      required: true,
    }),
  };

  static override description =
    "Subscribe to both spaces members and location update events";

  static override examples = [
    "$ ably spaces subscribe my-space",
    "$ ably spaces subscribe my-space --json",
    "$ ably spaces subscribe my-space --pretty-json",
    "$ ably spaces subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private listener: ((spaceState: { members: SpaceMember[] }) => void) | null =
    null;

  async finally(error: Error | undefined): Promise<void> {
    if (this.space && this.listener) {
      try {
        this.space.unsubscribe("update", this.listener);
      } catch (error_) {
        this.debug(`Failed to unsubscribe from space update: ${error_}`);
      }
    }

    await super.finally(error);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesSubscribe);
    const { space_name: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Subscribing to space updates"));
      }
      this.logJsonStatus(
        JsonStatusType.Subscribing,
        `Subscribing to space updates in space: ${spaceName}.`,
        flags,
      );

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      this.logCliEvent(
        flags,
        "space",
        "subscribing",
        "Subscribing to space updates",
      );

      this.listener = (spaceState: { members: SpaceMember[] }) => {
        const { members } = spaceState;

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(
            {
              space: {
                members: members.map((m) => formatMemberOutput(m)),
              },
            },
            flags,
          );
        } else {
          this.log(
            `${formatTimestamp(new Date().toISOString())} Found ${formatCountLabel(members.length, "member")} on space: ${formatResource(spaceName)}`,
          );

          for (const member of members) {
            this.log(formatMemberBlock(member));
            this.log("");
          }
        }
      };

      // space.subscribe() is synchronous (calls super.on()), no await needed
      this.space!.subscribe("update", this.listener);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(`Subscribed to space: ${formatResource(spaceName)}.`),
        );
        this.log(formatListening("Listening for space updates."));
      }
      this.logJsonStatus(
        JsonStatusType.Listening,
        "Listening for space updates.",
        flags,
      );

      this.logCliEvent(
        flags,
        "space",
        "subscribed",
        "Subscribed to space updates",
      );

      await this.waitAndTrackCleanup(flags, "space", flags.duration);
    } catch (error) {
      this.fail(error, flags, "spaceSubscribe");
    }
  }
}
