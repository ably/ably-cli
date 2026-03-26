import { Args, Flags } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { JsonStatusType } from "../../../utils/json-status.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatSuccess,
  formatListening,
  formatProgress,
  formatResource,
  formatLabel,
  formatClientId,
} from "../../../utils/output.js";

export default class SpacesLocationsSet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to set location in",
      required: true,
    }),
  };

  static override description = "Set location in a space";

  static override examples = [
    '$ ably spaces locations set my-space --location \'{"x":10,"y":20}\'',
    '$ ably spaces locations set my-space --location \'{"sectionId":"section1"}\'',
    '$ ably spaces locations set my-space --location \'{"x":10,"y":20}\' --json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    location: Flags.string({
      description: "Location data to set (JSON format)",
      required: true,
    }),
    ...durationFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsSet);
    const { space_name: spaceName } = args;

    const location = this.parseJsonFlag(flags.location, "location", flags);

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Entering space"));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      await this.enterCurrentSpace(flags);

      this.logCliEvent(flags, "location", "setting", "Setting location", {
        location,
      });
      await this.space!.locations.set(location);
      this.logCliEvent(flags, "location", "setSuccess", "Set location", {
        location,
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ location }, flags);
      } else {
        this.log(
          formatSuccess(`Location set in space: ${formatResource(spaceName)}.`),
        );
        this.log(
          `${formatLabel("Client ID")} ${formatClientId(this.realtimeClient!.auth.clientId)}`,
        );
        this.log(
          `${formatLabel("Connection ID")} ${this.realtimeClient!.connection.id}`,
        );
        this.log(`${formatLabel("Location")} ${JSON.stringify(location)}`);
        this.log(formatListening("Holding location."));
      }

      this.logJsonStatus(
        JsonStatusType.Holding,
        "Holding location. Press Ctrl+C to exit.",
        flags,
      );

      await this.waitAndTrackCleanup(flags, "location", flags.duration);
    } catch (error) {
      this.fail(error, flags, "locationSet");
    }
  }
}
