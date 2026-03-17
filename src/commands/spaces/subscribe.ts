import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import {
  formatCountLabel,
  formatListening,
  formatProgress,
  formatTimestamp,
} from "../../utils/output.js";
import {
  formatMemberBlock,
  formatMemberOutput,
} from "../../utils/spaces-output.js";

export default class SpacesSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to",
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
    const { space: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Subscribing to space updates"));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      if (!this.shouldOutputJson(flags)) {
        this.log(`\n${formatListening("Listening for space updates.")}\n`);
      }

      this.logCliEvent(
        flags,
        "space",
        "subscribing",
        "Subscribing to space updates",
      );

      this.listener = (spaceState: { members: SpaceMember[] }) => {
        const timestamp = new Date().toISOString();
        const members = spaceState.members;

        this.logCliEvent(flags, "space", "update", "Space update received", {
          memberCount: members.length,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(
            { members: members.map((m) => formatMemberOutput(m)) },
            flags,
          );
        } else {
          this.log(formatTimestamp(timestamp));
          this.log(
            `Space update (${formatCountLabel(members.length, "member")}):\n`,
          );

          for (const member of members) {
            this.log(formatMemberBlock(member, { indent: "  " }));
            this.log("");
          }
        }
      };

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
