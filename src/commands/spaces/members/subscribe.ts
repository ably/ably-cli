import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatListening,
  formatMessageTimestamp,
  formatProgress,
  formatTimestamp,
} from "../../../utils/output.js";
import {
  formatMemberEventBlock,
  formatMemberOutput,
} from "../../../utils/spaces-output.js";

export default class SpacesMembersSubscribe extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to subscribe to members for",
      required: true,
    }),
  };

  static override description =
    "Subscribe to member presence events in a space";

  static override examples = [
    "$ ably spaces members subscribe my-space",
    "$ ably spaces members subscribe my-space --json",
    "$ ably spaces members subscribe my-space --pretty-json",
    "$ ably spaces members subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesMembersSubscribe);
    const { space_name: spaceName } = args;

    // Keep track of the last event we've seen for each client to avoid duplicates
    const lastSeenEvents = new Map<
      string,
      { action: string; timestamp: number }
    >();

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Subscribing to member updates"));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      if (!this.shouldOutputJson(flags)) {
        this.log(formatListening("Listening for member events."));
      }

      // Subscribe to member presence events
      this.logCliEvent(
        flags,
        "member",
        "subscribing",
        "Subscribing to member updates",
      );

      const memberListener = (member: SpaceMember) => {
        const now = Date.now();

        // Determine the action from the member's lastEvent
        const action = member.lastEvent.name;
        const clientId = member.clientId || "Unknown";
        const connectionId = member.connectionId || "Unknown";

        // Create a unique key for this client+connection combination
        const clientKey = `${clientId}:${connectionId}`;

        // Check if we've seen this exact event recently (within 500ms)
        const lastEvent = lastSeenEvents.get(clientKey);

        if (
          lastEvent &&
          lastEvent.action === action &&
          now - lastEvent.timestamp < 500
        ) {
          this.logCliEvent(
            flags,
            "member",
            "duplicateEventSkipped",
            `Skipping duplicate event '${action}' for ${clientId}`,
            { action, clientId },
          );
          return; // Skip duplicate events within 500ms window
        }

        // Update the last seen event for this client+connection
        lastSeenEvents.set(clientKey, {
          action,
          timestamp: now,
        });

        this.logCliEvent(
          flags,
          "member",
          `update-${action}`,
          `Member event '${action}' received`,
          { action, clientId, connectionId },
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ member: formatMemberOutput(member) }, flags);
        } else {
          this.log(
            formatTimestamp(formatMessageTimestamp(member.lastEvent.timestamp)),
          );
          this.log(formatMemberEventBlock(member, action));
          this.log("");
        }
      };

      // Subscribe using the listener
      this.space!.members.subscribe("update", memberListener);

      this.logCliEvent(
        flags,
        "member",
        "subscribed",
        "Subscribed to member updates",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "member", flags.duration);
    } catch (error) {
      this.fail(error, flags, "memberSubscribe");
    }
  }
}
