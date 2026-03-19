import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
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

  static override description = "Subscribe to space update events";

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

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesSubscribe);
    const { space_name: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Subscribing to space updates"));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(`Subscribed to space: ${formatResource(spaceName)}.`),
        );
        this.log(formatListening("Listening for space updates."));
      }

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
            `Found ${formatCountLabel(members.length, "member")} on space: ${formatResource(spaceName)}`,
          );

          for (const member of members) {
            this.log(formatTimestamp(new Date().toISOString()));
            this.log(formatMemberBlock(member));
            this.log("");
          }
        }
      };

      // space.subscribe() is synchronous (calls super.on()), no await needed
      this.space!.subscribe("update", this.listener);

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
