import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatCountLabel,
  formatHeading,
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";

interface LocationEntry {
  connectionId: string;
  location: unknown;
}

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
          formatProgress(`Connecting to space: ${formatResource(spaceName)}`),
        );
      }

      await this.space!.enter();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for space connection"));
        }, 5000);

        const checkSpaceStatus = () => {
          try {
            if (this.realtimeClient!.connection.state === "connected") {
              clearTimeout(timeout);
              if (!this.shouldOutputJson(flags)) {
                this.log(
                  formatSuccess(
                    `Connected to space: ${formatResource(spaceName)}.`,
                  ),
                );
              }

              resolve();
            } else if (
              this.realtimeClient!.connection.state === "failed" ||
              this.realtimeClient!.connection.state === "closed" ||
              this.realtimeClient!.connection.state === "suspended"
            ) {
              clearTimeout(timeout);
              reject(
                new Error(
                  `Space connection failed with connection state: ${this.realtimeClient!.connection.state}`,
                ),
              );
            } else {
              setTimeout(checkSpaceStatus, 100);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        checkSpaceStatus();
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
              spaceName,
              timestamp: new Date().toISOString(),
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

          for (const entry of entries) {
            this.log(`- ${formatClientId(entry.connectionId)}:`);
            this.log(
              `  ${formatLabel("Location")} ${JSON.stringify(entry.location, null, 2)}`,
            );
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
