import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatCountLabel,
  formatHeading,
  formatIndex,
  formatProgress,
  formatResource,
  formatWarning,
} from "../../../utils/output.js";
import {
  formatMemberBlock,
  formatMemberOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesMembersGetAll extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get members from",
      required: true,
    }),
  };

  static override description = "Get all members in a space";

  static override examples = [
    "$ ably spaces members get-all my-space",
    "$ ably spaces members get-all my-space --json",
    "$ ably spaces members get-all my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesMembersGetAll);
    const { space: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching members for space ${formatResource(spaceName)}`,
          ),
        );
      }

      try {
        const members: SpaceMember[] = await this.space!.members.getAll();

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            {
              members: members.map((member) => formatMemberOutput(member)),
            },
            flags,
          );
        } else if (members.length === 0) {
          this.log(formatWarning("No members currently in this space."));
        } else {
          this.log(
            `\n${formatHeading("Current members")} (${formatCountLabel(members.length, "member")}):\n`,
          );

          for (let i = 0; i < members.length; i++) {
            const member = members[i];
            this.log(`${formatIndex(i + 1)}`);
            this.log(formatMemberBlock(member, { indent: "  " }));
            this.log("");
          }
        }
      } catch (error) {
        this.fail(error, flags, "memberGetAll", { spaceName });
      }
    } catch (error) {
      this.fail(error, flags, "memberGetAll", { spaceName });
    }
  }
}
