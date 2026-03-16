import type { LocationsEvents } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatListening,
  formatSuccess,
  formatTimestamp,
} from "../../../utils/output.js";
import { formatLocationUpdateBlock } from "../../../utils/spaces-output.js";

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
            this.logCliEvent(
              flags,
              "location",
              "updateReceived",
              "Location update received",
              {
                clientId: update.member.clientId,
                connectionId: update.member.connectionId,
                timestamp,
              },
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(
                {
                  location: {
                    member: {
                      clientId: update.member.clientId,
                      connectionId: update.member.connectionId,
                    },
                    currentLocation: update.currentLocation,
                    previousLocation: update.previousLocation,
                    timestamp,
                  },
                },
                flags,
              );
            } else {
              this.log(formatTimestamp(timestamp));
              this.log(formatLocationUpdateBlock(update));
              this.log("");
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
