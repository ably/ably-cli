import type { SpaceMember } from "@ably/spaces";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatHeading,
  formatListening,
  formatPresenceAction,
  formatProgress,
  formatTimestamp,
  formatLabel,
} from "../../../utils/output.js";

export default class SpacesMembersSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to members for",
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

  private listener: ((member: SpaceMember) => void) | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesMembersSubscribe);
    const { space: spaceName } = args;

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

      await this.initializeSpace(flags, spaceName, { enterSpace: true });

      // Get current members
      this.logCliEvent(
        flags,
        "member",
        "gettingInitial",
        "Fetching initial members",
      );
      const members = await this.space!.members.getAll();
      const initialMembers = members.map((member) => ({
        clientId: member.clientId,
        connectionId: member.connectionId,
        isConnected: member.isConnected,
        profileData: member.profileData,
      }));
      this.logCliEvent(
        flags,
        "member",
        "gotInitial",
        `Fetched ${members.length} initial members`,
        { count: members.length, members: initialMembers },
      );

      // Output current members
      if (members.length === 0) {
        if (!this.shouldOutputJson(flags)) {
          this.log(
            chalk.yellow("No members are currently present in this space."),
          );
        }
      } else if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            members: initialMembers,
            spaceName,
            status: "connected",
          },
          flags,
        );
      } else {
        this.log(
          `\n${formatHeading("Current members")} (${chalk.bold(members.length.toString())}):\n`,
        );

        for (const member of members) {
          this.log(`- ${formatClientId(member.clientId || "Unknown")}`);

          if (
            member.profileData &&
            Object.keys(member.profileData).length > 0
          ) {
            this.log(
              `  ${formatLabel("Profile")} ${JSON.stringify(member.profileData, null, 2)}`,
            );
          }

          if (member.connectionId) {
            this.log(
              `  ${formatLabel("Connection ID")} ${member.connectionId}`,
            );
          }

          if (member.isConnected === false) {
            this.log(`  ${formatLabel("Status")} Not connected`);
          }
        }
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(`\n${formatListening("Listening for member events.")}\n`);
      }

      // Subscribe to member presence events
      this.logCliEvent(
        flags,
        "member",
        "subscribing",
        "Subscribing to member updates",
      );
      // Define the listener function
      this.listener = (member: SpaceMember) => {
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

          if (
            member.profileData &&
            Object.keys(member.profileData).length > 0
          ) {
            this.log(
              `  ${formatLabel("Profile")} ${JSON.stringify(member.profileData, null, 2)}`,
            );
          }

          if (connectionId !== "Unknown") {
            this.log(`  ${formatLabel("Connection ID")} ${connectionId}`);
          }

          if (member.isConnected === false) {
            this.log(`  ${formatLabel("Status")} Not connected`);
          }
        }
      };

      // Subscribe using the stored listener
      await this.space!.members.subscribe("update", this.listener);

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
      this.fail(error, flags, "MemberSubscribe");
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
