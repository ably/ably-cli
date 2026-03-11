import type { ProfileData, SpaceMember } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatSuccess,
  formatListening,
  formatResource,
  formatTimestamp,
  formatPresenceAction,
  formatClientId,
  formatLabel,
} from "../../../utils/output.js";

export default class SpacesMembersEnter extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to enter",
      required: true,
    }),
  };

  static override description =
    "Enter a space and remain present until terminated";

  static override examples = [
    "$ ably spaces members enter my-space",
    '$ ably spaces members enter my-space --profile \'{"name":"User","status":"active"}\'',
    "$ ably spaces members enter my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    profile: Flags.string({
      description:
        "Optional profile data to include with the member (JSON format)",
      required: false,
    }),
    ...durationFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesMembersEnter);
    const { space: spaceName } = args;

    // Keep track of the last event we've seen for each client to avoid duplicates
    const lastSeenEvents = new Map<
      string,
      { action: string; timestamp: number }
    >();

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log(formatListening("Entering space."));
      }

      await this.initializeSpace(flags, spaceName, { enterSpace: false });

      // Parse profile data if provided
      let profileData: ProfileData | undefined;
      if (flags.profile) {
        const parsed = this.parseJsonFlag(flags.profile, "profile", flags);
        profileData = parsed as ProfileData;
        this.logCliEvent(
          flags,
          "member",
          "profileParsed",
          "Profile data parsed successfully",
          { profileData },
        );
      }

      // Enter the space with optional profile
      this.logCliEvent(
        flags,
        "member",
        "enteringSpace",
        "Attempting to enter space",
        { profileData },
      );
      await this.space!.enter(profileData);
      const enteredEventData = {
        connectionId: this.realtimeClient!.connection.id,
        profile: profileData,
        spaceName,
        status: "connected",
      };
      this.logCliEvent(
        flags,
        "member",
        "enteredSpace",
        "Entered space",
        enteredEventData,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(enteredEventData, flags);
      } else {
        this.log(formatSuccess(`Entered space: ${formatResource(spaceName)}.`));
        if (profileData) {
          this.log(
            `${formatLabel("Profile")} ${JSON.stringify(profileData, null, 2)}`,
          );
        } else {
          // No profile data provided
          this.logCliEvent(
            flags,
            "member",
            "noProfileData",
            "No profile data provided",
          );
        }
      }

      // Subscribe to member presence events to show other members' activities
      this.logCliEvent(
        flags,
        "member",
        "subscribing",
        "Subscribing to member updates",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(`\n${formatListening("Watching for other members.")}\n`);
      }

      // Define the listener function
      const listener = (member: SpaceMember) => {
        const timestamp = new Date().toISOString();
        const now = Date.now();

        // Determine the action from the member's lastEvent
        const action = member.lastEvent?.name || "unknown";
        const clientId = member.clientId || "Unknown";
        const connectionId = member.connectionId || "Unknown";

        // Skip self events - check connection ID
        const selfConnectionId = this.realtimeClient!.connection.id;
        if (member.connectionId === selfConnectionId) {
          return;
        }

        // Create a unique key for this client+connection combination
        const clientKey = `${clientId}:${connectionId}`;

        // Check if we've seen this exact event recently (within 500ms)
        // This helps avoid duplicate enter/leave events that might come through
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

        const memberEventData = {
          action,
          member: {
            clientId: member.clientId,
            connectionId: member.connectionId,
            isConnected: member.isConnected,
            profileData: member.profileData,
          },
          spaceName,
          timestamp,
          eventType: "member_update",
        };
        this.logCliEvent(
          flags,
          "member",
          `update-${action}`,
          `Member event '${action}' received`,
          memberEventData,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(memberEventData, flags);
        } else {
          const { symbol: actionSymbol, color: actionColor } =
            formatPresenceAction(action);

          this.log(
            `${formatTimestamp(timestamp)} ${actionColor(actionSymbol)} ${formatClientId(clientId)} ${actionColor(action)}`,
          );

          const hasProfileData =
            member.profileData && Object.keys(member.profileData).length > 0;

          if (hasProfileData) {
            this.log(
              `  ${formatLabel("Profile")} ${JSON.stringify(member.profileData, null, 2)}`,
            );
          } else {
            // No profile data available
            this.logCliEvent(
              flags,
              "member",
              "noProfileDataForMember",
              "No profile data available for member",
            );
          }

          if (connectionId === "Unknown") {
            // Connection ID is unknown
            this.logCliEvent(
              flags,
              "member",
              "unknownConnectionId",
              "Connection ID is unknown for member",
            );
          } else {
            this.log(`  ${formatLabel("Connection ID")} ${connectionId}`);
          }

          if (member.isConnected === false) {
            this.log(`  ${formatLabel("Status")} Not connected`);
          } else {
            // Member is connected
            this.logCliEvent(
              flags,
              "member",
              "memberConnected",
              "Member is connected",
            );
          }
        }
      };

      // Subscribe using the stored listener
      await this.space!.members.subscribe("update", listener);

      this.logCliEvent(
        flags,
        "member",
        "subscribed",
        "Subscribed to member updates",
      );

      this.logCliEvent(
        flags,
        "member",
        "listening",
        "Listening for member updates...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "member", flags.duration);
    } catch (error) {
      this.fail(error, flags, "MemberEnter");
    } finally {
      if (!this.shouldOutputJson(flags || {})) {
        if (this.cleanupInProgress) {
          this.log(formatSuccess("Graceful shutdown complete."));
        } else {
          // Normal completion without user interrupt
          this.logCliEvent(
            flags || {},
            "member",
            "completedNormally",
            "Command completed normally",
          );
        }
      }
    }
  }
}
