import type { ProfileData } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatSuccess,
  formatListening,
  formatProgress,
  formatResource,
  formatLabel,
  formatClientId,
} from "../../../utils/output.js";
import { formatMemberOutput } from "../../../utils/spaces-output.js";

export default class SpacesMembersEnter extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to enter",
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
    const { space: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Entering space"));
      }

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
      this.logCliEvent(
        flags,
        "member",
        "enteringSpace",
        "Attempting to enter space",
        { profileData },
      );
      await this.space!.enter(profileData);
      this.markAsEntered();
      this.logCliEvent(flags, "member", "enteredSpace", "Entered space", {
        connectionId: this.realtimeClient!.connection.id,
        profileData,
      });

      if (this.shouldOutputJson(flags)) {
        const self = await this.space!.members.getSelf();
        this.logJsonResult({ members: [formatMemberOutput(self!)] }, flags);
      } else {
        this.log(formatSuccess(`Entered space: ${formatResource(spaceName)}.`));
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

      if (!this.shouldOutputJson(flags)) {
        this.log(`\n${formatListening("Holding presence.")}\n`);
      }

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "member", flags.duration);
    } catch (error) {
      this.fail(error, flags, "memberEnter");
    }
  }
}
