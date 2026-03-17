import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
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

export default class SpacesLocationsGetAll extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get locations from",
      required: true,
    }),
  };

  static override description = "Get all current locations in a space";

  static override examples = [
    "$ ably spaces locations get-all my-space",
    "$ ably spaces locations get-all my-space --json",
    "$ ably spaces locations get-all my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsGetAll);
    const { space: spaceName } = args;

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

      try {
        const locationsFromSpace = await this.space!.locations.getAll();

        const entries: LocationEntry[] = Object.entries(locationsFromSpace)
          .filter(
            ([, loc]) =>
              loc != null &&
              !(
                typeof loc === "object" &&
                Object.keys(loc as object).length === 0
              ),
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
          this.log(
            formatWarning("No locations are currently set in this space."),
          );
        } else {
          this.log(
            `\n${formatHeading("Current locations")} (${formatCountLabel(entries.length, "location")}):\n`,
          );

          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            this.log(`${formatIndex(i + 1)}`);
            this.log(`  ${formatLabel("Connection ID")} ${entry.connectionId}`);
            this.log(
              `  ${formatLabel("Location")} ${JSON.stringify(entry.location)}`,
            );
            this.log("");
          }
        }
      } catch (error) {
        this.fail(error, flags, "locationGetAll", { spaceName });
      }
    } catch (error) {
      this.fail(error, flags, "locationGetAll", { spaceName });
    }
  }
}
