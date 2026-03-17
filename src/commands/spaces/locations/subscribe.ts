import type { LocationsEvents } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatListening,
  formatProgress,
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

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Subscribing to location updates"));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      if (!this.shouldOutputJson(flags)) {
        this.log(`\n${formatListening("Listening for location updates.")}\n`);
      }

      this.logCliEvent(
        flags,
        "location",
        "subscribing",
        "Subscribing to location updates",
      );

      try {
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

      await this.waitAndTrackCleanup(flags, "location", flags.duration);
    } catch (error) {
      this.fail(error, flags, "locationSubscribe", { spaceName });
    }
  }
}
