import { Args, Flags } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { formatSuccess, formatResource } from "../../../utils/output.js";

export default class SpacesLocationsSet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to set location in",
      required: true,
    }),
  };

  static override description = "Set your location in a space";

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
  };

  async finally(err: Error | undefined): Promise<void> {
    // Clear location before leaving space
    if (this.space && this.hasEnteredSpace) {
      try {
        await Promise.race([
          this.space.locations.set(null),
          new Promise<void>((resolve) => setTimeout(resolve, 1000)),
        ]);
      } catch {
        // Ignore cleanup errors
      }
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsSet);
    const { space_name: spaceName } = args;

    // Parse location data first
    const location = this.parseJsonFlag(flags.location, "location", flags);
    this.logCliEvent(
      flags,
      "location",
      "dataParsed",
      "Location data parsed successfully",
      { location },
    );

    try {
      await this.initializeSpace(flags, spaceName, { enterSpace: true });

      // Set the location
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
      }
    } catch (error) {
      this.fail(error, flags, "locationSet");
    }
  }
}
