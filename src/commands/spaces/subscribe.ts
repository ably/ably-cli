import type { SpaceMember, LocationsEvents } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import {
  formatEventType,
  formatLabel,
  formatMessageTimestamp,
  formatResource,
  formatTimestamp,
} from "../../utils/output.js";
import {
  formatMemberEventBlock,
  formatMemberOutput,
  formatLocationUpdateBlock,
} from "../../utils/spaces-output.js";

export default class SpacesSubscribe extends SpacesBaseCommand {
  static override args = {
    spaceName: Args.string({
      description: "Name of the space to subscribe to",
      required: true,
    }),
  };

  static override description =
    "Subscribe to both spaces members and location update events";

  static override examples = [
    "$ ably spaces subscribe my-space",
    "$ ably spaces subscribe my-space --json",
    "$ ably spaces subscribe my-space --pretty-json",
    "$ ably spaces subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesSubscribe);
    const { spaceName } = args;

    // Keep track of the last event we've seen for each client to avoid duplicates
    const lastSeenEvents = new Map<
      string,
      { action: string; timestamp: number }
    >();

    try {
      this.logProgress("Subscribing to space updates", flags);

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      this.logCliEvent(
        flags,
        "spaceSubscribe",
        "subscribing",
        "Subscribing to space updates",
      );

      // --- Member listener (from members/subscribe pattern) ---
      const memberListener = (member: SpaceMember) => {
        const now = Date.now();

        const action = member.lastEvent.name;
        const clientId = member.clientId;
        const connectionId = member.connectionId;

        // Dedup within 500ms window
        const clientKey = `${clientId}:${connectionId}`;
        const lastEvent = lastSeenEvents.get(clientKey);

        if (
          lastEvent &&
          lastEvent.action === action &&
          now - lastEvent.timestamp < 500
        ) {
          this.logCliEvent(
            flags,
            "spaceSubscribe",
            "duplicateEventSkipped",
            `Skipping duplicate event '${action}' for ${clientId}`,
            { action, clientId },
          );
          return;
        }

        lastSeenEvents.set(clientKey, { action, timestamp: now });

        this.logCliEvent(
          flags,
          "spaceSubscribe",
          `memberUpdate-${action}`,
          `Member event '${action}' received`,
          { action, clientId, connectionId },
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(
            { eventType: "member", member: formatMemberOutput(member) },
            flags,
          );
        } else {
          this.log(
            formatTimestamp(formatMessageTimestamp(member.lastEvent.timestamp)),
          );
          this.log(`${formatLabel("Type")} ${formatEventType("member")}`);
          this.log(formatMemberEventBlock(member, action));
          this.log("");
        }
      };

      // --- Location listener (from locations/subscribe pattern) ---
      const locationListener = (update: LocationsEvents.UpdateEvent) => {
        const timestamp = new Date().toISOString();

        this.logCliEvent(
          flags,
          "spaceSubscribe",
          "locationUpdateReceived",
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
              eventType: "location",
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
          this.log(`${formatLabel("Type")} ${formatEventType("location")}`);
          this.log(formatLocationUpdateBlock(update));
          this.log("");
        }
      };

      // Subscribe to both member and location events
      this.space!.members.subscribe("update", memberListener);
      this.space!.locations.subscribe("update", locationListener);

      this.logSuccessMessage(
        `Subscribed to space: ${formatResource(spaceName)}.`,
        flags,
      );
      this.logListening("Listening for space updates.", flags);

      this.logCliEvent(
        flags,
        "spaceSubscribe",
        "subscribed",
        "Subscribed to space updates",
      );

      await this.waitAndTrackCleanup(flags, "spaceSubscribe", flags.duration);
    } catch (error) {
      this.fail(error, flags, "spaceSubscribe");
    }
  }
}
