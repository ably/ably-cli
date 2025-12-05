import type { ProfileData, SpaceMember } from "@ably/spaces";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

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
    ...SpacesBaseCommand.globalFlags,
    profile: Flags.string({
      description:
        "Optional profile data to include with the member (JSON format)",
      required: false,
    }),
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
  };

  private cleanupInProgress = false;

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
        this.log(`${chalk.dim("Entering space. Press Ctrl+C to exit.")}`);
      }

      // Create Spaces client using setupSpacesClient
      const setupResult = await this.setupSpacesClient(flags, spaceName);
      this.realtimeClient = setupResult.realtimeClient;
      this.space = setupResult.space;
      if (!this.realtimeClient || !this.space) {
        this.error("Failed to initialize clients or space");
        return;
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.realtimeClient, flags, {
        includeUserFriendlyMessages: true,
      });

      // Parse profile data if provided
      let profileData: ProfileData | undefined;
      if (flags.profile) {
        try {
          profileData = JSON.parse(flags.profile);
          this.logCliEvent(
            flags,
            "member",
            "profileParsed",
            "Profile data parsed successfully",
            { profileData },
          );
        } catch (error) {
          const errorMsg = `Invalid profile JSON: ${error instanceof Error ? error.message : String(error)}`;
          this.logCliEvent(flags, "member", "profileParseError", errorMsg, {
            error: errorMsg,
            spaceName,
          });
          if (this.shouldOutputJson(flags)) {
            this.jsonError(
              { error: errorMsg, spaceName, success: false },
              flags,
            );
          } else {
            this.error(errorMsg);
          }

          return;
        }
      }

      // Get the space
      this.logCliEvent(
        flags,
        "spaces",
        "gettingSpace",
        `Getting space: ${spaceName}...`,
      );
      this.logCliEvent(
        flags,
        "spaces",
        "gotSpace",
        `Successfully got space handle: ${spaceName}`,
      );

      // Enter the space with optional profile
      this.logCliEvent(
        flags,
        "member",
        "enteringSpace",
        "Attempting to enter space",
        { profileData },
      );
      await this.space.enter(profileData);
      const enteredEventData = {
        connectionId: this.realtimeClient.connection.id,
        profile: profileData,
        spaceName,
        status: "connected",
      };
      this.logCliEvent(
        flags,
        "member",
        "enteredSpace",
        "Successfully entered space",
        enteredEventData,
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput({ success: true, ...enteredEventData }, flags),
        );
      } else {
        this.log(
          `${chalk.green("Successfully entered space:")} ${chalk.cyan(spaceName)}`,
        );
        if (profileData) {
          this.log(
            `${chalk.dim("Profile:")} ${JSON.stringify(profileData, null, 2)}`,
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
        this.log(
          `\n${chalk.dim("Watching for other members. Press Ctrl+C to exit.")}\n`,
        );
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
          type: "member_update",
        };
        this.logCliEvent(
          flags,
          "member",
          `update-${action}`,
          `Member event '${action}' received`,
          memberEventData,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput({ success: true, ...memberEventData }, flags),
          );
        } else {
          let actionSymbol = "•";
          let actionColor = chalk.white;

          switch (action) {
            case "enter": {
              actionSymbol = "✓";
              actionColor = chalk.green;
              break;
            }

            case "leave": {
              actionSymbol = "✗";
              actionColor = chalk.red;
              break;
            }

            case "update": {
              actionSymbol = "⟲";
              actionColor = chalk.yellow;
              break;
            }
          }

          this.log(
            `[${timestamp}] ${actionColor(actionSymbol)} ${chalk.blue(clientId)} ${actionColor(action)}`,
          );

          const hasProfileData =
            member.profileData && Object.keys(member.profileData).length > 0;

          if (hasProfileData) {
            this.log(
              `  ${chalk.dim("Profile:")} ${JSON.stringify(member.profileData, null, 2)}`,
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
            this.log(`  ${chalk.dim("Connection ID:")} ${connectionId}`);
          }

          if (member.isConnected === false) {
            this.log(`  ${chalk.dim("Status:")} Not connected`);
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
      await this.space.members.subscribe("update", listener);

      this.logCliEvent(
        flags,
        "member",
        "subscribed",
        "Successfully subscribed to member updates",
      );

      this.logCliEvent(
        flags,
        "member",
        "listening",
        "Listening for member updates...",
      );

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
      this.logCliEvent(flags, "member", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal";
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
      this.logCliEvent(flags, "error", "unhandledError", errorMsg, {
        error: errorMsg,
      });
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    } finally {
      if (!this.shouldOutputJson(flags || {})) {
        if (this.cleanupInProgress) {
          this.log(chalk.green("Graceful shutdown complete (user interrupt)."));
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
