import type { ProfileData } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatResource,
  formatLabel,
  formatClientId,
} from "../../../utils/output.js";
import { formatMemberOutput } from "../../../utils/spaces-output.js";

export default class SpacesMembersEnter extends SpacesBaseCommand {
  static override args = {
    spaceName: Args.string({
      description: "Name of the space to enter",
      required: true,
    }),
  };

  static override description =
    "Enter a space and remain present until terminated";

  static override examples = [
    "$ ably spaces members enter my-space",
    '$ ably spaces members enter my-space --profile \'{"name":"User","status":"active"}\'',
    "$ ably spaces members enter my-space --duration 30",
    "$ ably spaces members enter my-space --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    profile: Flags.string({
      description:
        "Optional profile data to include with the member (JSON format)",
      required: false,
    }),
    ...durationFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesMembersEnter);
    const { spaceName } = args;

    try {
      this.logProgress("Entering space", flags);

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      // Parse profile data if provided
      let profileData: ProfileData | undefined;
      if (flags.profile) {
        const parsed = this.parseJsonFlag(flags.profile, "profile", flags);
        profileData = parsed as ProfileData;
        this.logCliEvent(
          flags,
          "member",
          "profileParsed",
          "Profile data parsed successfully",
          { profileData },
        );
      }

      // Enter the space with optional profile
      await this.enterCurrentSpace(
        flags,
        profileData as Record<string, unknown>,
      );

      if (this.shouldOutputJson(flags)) {
        const self = await this.space!.members.getSelf();
        this.logJsonResult({ member: formatMemberOutput(self!) }, flags);
      } else {
        this.logSuccessMessage(
          `Entered space: ${formatResource(spaceName)}.`,
          flags,
        );
        this.log(
          `${formatLabel("Client ID")} ${formatClientId(this.realtimeClient!.auth.clientId)}`,
        );
        this.log(
          `${formatLabel("Connection ID")} ${this.realtimeClient!.connection.id}`,
        );
        if (profileData) {
          this.log(`${formatLabel("Profile")} ${JSON.stringify(profileData)}`);
        }
      }
      this.logHolding("Holding presence.", flags);

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "member", flags.duration);
    } catch (error) {
      this.fail(error, flags, "memberEnter");
    }
  }
}
