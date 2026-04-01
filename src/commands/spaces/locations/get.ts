import { Args } from "@oclif/core";

import { productApiFlags } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatCountLabel,
  formatHeading,
  formatIndex,
  formatLabel,
  formatProgress,
  formatResource,
  formatWarning,
} from "../../../utils/output.js";
import type { LocationEntry } from "../../../utils/spaces-output.js";

export default class SpacesLocationsGet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to get locations from",
      required: true,
    }),
  };

  static override description = "Get all current locations in a space";

  static override examples = [
    "$ ably spaces locations get my-space",
    "$ ably spaces locations get my-space --json",
    "$ ably spaces locations get my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsGet);
    const { space_name: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching locations for space ${formatResource(spaceName)}`,
          ),
        );
      }

      const locationsFromSpace = await this.space!.locations.getAll();

      const entries: LocationEntry[] = Object.entries(locationsFromSpace)
        .filter(
          ([, loc]) =>
            loc != null &&
            !(typeof loc === "object" && Object.keys(loc).length === 0),
        )
        .map(([connectionId, loc]) => ({ connectionId, location: loc }));

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            locations: entries.map((entry) => ({
              connectionId: entry.connectionId,
              location: entry.location,
            })),
          },
          flags,
        );
      } else if (entries.length === 0) {
        this.logToStderr(
          formatWarning("No locations are currently set in this space."),
        );
      } else {
        this.log(
          `\n${formatHeading("Current locations")} (${formatCountLabel(entries.length, "location")}):\n`,
        );

        for (const [i, entry] of entries.entries()) {
          this.log(`${formatIndex(i + 1)}`);
          this.log(`  ${formatLabel("Connection ID")} ${entry.connectionId}`);
          this.log(
            `  ${formatLabel("Location")} ${JSON.stringify(entry.location)}`,
          );
          this.log("");
        }
      }
    } catch (error) {
      this.fail(error, flags, "locationGet", { spaceName });
    }
  }
}
