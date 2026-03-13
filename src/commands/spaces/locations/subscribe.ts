import type { LocationsEvents } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatCountLabel,
  formatEventType,
  formatHeading,
  formatLabel,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatWarning,
} from "../../../utils/output.js";

interface LocationEntry {
  connectionId: string;
  location: unknown;
}

export default class SpacesLocationsSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to locations for",
      required: true,
    }),
  };

  static override description =
    "Subscribe to location updates for members in a space";

  static override examples = [
    "$ ably spaces locations subscribe my-space",
    "$ ably spaces locations subscribe my-space --json",
    "$ ably spaces locations subscribe my-space --pretty-json",
    "$ ably spaces locations subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsSubscribe);
    const { space: spaceName } = args;
    this.logCliEvent(
      flags,
      "subscribe.run",
      "start",
      `Starting spaces locations subscribe for space: ${spaceName}`,
    );

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log("Subscribing to location updates");
      }
      this.logCliEvent(
        flags,
        "subscribe.run",
        "initialSignalLogged",
        "Initial readiness signal logged.",
      );

      await this.initializeSpace(flags, spaceName, { enterSpace: true });

      // Get current locations
      this.logCliEvent(
        flags,
        "location",
        "gettingInitial",
        `Fetching initial locations for space ${spaceName}`,
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching current locations for space ${formatResource(spaceName)}`,
          ),
        );
      }

      let locations: LocationEntry[] = [];
      try {
        const result = await this.space!.locations.getAll();
        this.logCliEvent(
          flags,
          "location",
          "gotInitial",
          `Fetched initial locations`,
          { locations: result },
        );

        if (
          result &&
          typeof result === "object" &&
          Object.keys(result).length > 0
        ) {
          locations = Object.entries(result)
            .filter(([, loc]) => loc != null)
            .map(([connectionId, locationData]) => ({
              connectionId,
              location: locationData,
            }));
        }

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            {
              locations: locations.map((entry) => ({
                connectionId: entry.connectionId,
                location: entry.location,
              })),
              spaceName,
              eventType: "locations_snapshot",
            },
            flags,
          );
        } else if (locations.length === 0) {
          this.log(
            formatWarning("No locations are currently set in this space."),
          );
        } else {
          this.log(
            `\n${formatHeading("Current locations")} (${formatCountLabel(locations.length, "location")}):\n`,
          );
          for (const entry of locations) {
            this.log(`- ${formatClientId(entry.connectionId)}:`);
            this.log(
              `  ${formatLabel("Location")} ${JSON.stringify(entry.location)}`,
            );
          }
        }
      } catch (error) {
        this.fail(error, flags, "locationSubscribe", {
          spaceName,
        });
      }

      this.logCliEvent(
        flags,
        "location",
        "subscribing",
        "Subscribing to location updates",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(formatListening("Subscribing to location updates."));
      }
      this.logCliEvent(
        flags,
        "location.subscribe",
        "readySignalLogged",
        "Final readiness signal 'Subscribing to location updates' logged.",
      );

      try {
        // Define the location update handler
        const locationHandler = (update: LocationsEvents.UpdateEvent) => {
          try {
            const timestamp = new Date().toISOString();
            const eventData = {
              action: "update",
              location: update.currentLocation,
              member: {
                clientId: update.member.clientId,
                connectionId: update.member.connectionId,
              },
              previousLocation: update.previousLocation,
              timestamp,
            };
            this.logCliEvent(
              flags,
              "location",
              "updateReceived",
              "Location update received",
              { spaceName, ...eventData },
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(
                {
                  spaceName,
                  eventType: "location_update",
                  ...eventData,
                },
                flags,
              );
            } else {
              this.log(
                `${formatTimestamp(timestamp)} ${formatClientId(update.member.clientId)} ${formatEventType("updated")} location:`,
              );
              this.log(
                `  ${formatLabel("Current")} ${JSON.stringify(update.currentLocation)}`,
              );
              this.log(
                `  ${formatLabel("Previous")} ${JSON.stringify(update.previousLocation)}`,
              );
            }
          } catch (error) {
            this.fail(error, flags, "locationSubscribe", {
              spaceName,
            });
          }
        };

        // Subscribe to location updates
        this.space!.locations.subscribe("update", locationHandler);

        this.logCliEvent(
          flags,
          "location",
          "subscribed",
          "Successfully subscribed to location updates",
        );
      } catch (error) {
        this.fail(error, flags, "locationSubscribe", {
          spaceName,
        });
      }

      this.logCliEvent(
        flags,
        "location",
        "listening",
        "Listening for location updates...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "location", flags.duration);
    } catch (error) {
      this.fail(error, flags, "locationSubscribe", { spaceName });
    } finally {
      // Wrap all cleanup in a timeout to prevent hanging
      if (!this.shouldOutputJson(flags)) {
        if (this.cleanupInProgress) {
          this.log(formatSuccess("Graceful shutdown complete."));
        } else {
          this.log(
            formatSuccess("Duration elapsed, command finished cleanly."),
          );
        }
      }
    }
  }
}
