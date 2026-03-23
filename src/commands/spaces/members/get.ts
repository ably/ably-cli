import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags } from "../../../flags.js";
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

export default class SpacesMembersGet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to get members from",
      required: true,
    }),
  };

  static override description = "Get all members in a space";

  static override examples = [
    "$ ably spaces members get my-space",
    "$ ably spaces members get my-space --json",
    "$ ably spaces members get my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesMembersGet);
    this.validateSpaceName(args, flags);
    const { space_name: spaceName } = args;

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

      const members: SpaceMember[] = await this.space!.members.getAll();

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            members: members.map((member) => formatMemberOutput(member)),
          },
          flags,
        );
      } else if (members.length === 0) {
        this.logToStderr(formatWarning("No members currently in this space."));
      } else {
        this.log(
          `\n${formatHeading("Current members")} (${formatCountLabel(members.length, "member")}):\n`,
        );

        for (let i = 0; i < members.length; i++) {
          this.log(`${formatIndex(i + 1)}`);
          this.log(formatMemberBlock(members[i], { indent: "  " }));
          this.log("");
        }
      }
    } catch (error) {
      this.fail(error, flags, "memberGet", { spaceName });
    }
  }
}
