import { PresenceMember, ChatClient, Room, PresenceEvent } from "@ably/chat";
import { Args, Interfaces } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import {
  formatClientId,
  formatHeading,
  formatLabel,
  formatListening,
  formatPresenceAction,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
} from "../../../utils/output.js";

export default class RoomsPresenceSubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to subscribe to presence for",
      required: true,
    }),
  };

  static override description = "Subscribe to presence events in a chat room";

  static override examples = [
    "$ ably rooms presence subscribe my-room",
    "$ ably rooms presence subscribe my-room --json",
    "$ ably rooms presence subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;
  private roomName: string | null = null;
  private room: Room | null = null;
  private commandFlags: Interfaces.InferredFlags<
    typeof RoomsPresenceSubscribe.flags
  > | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsPresenceSubscribe);
    this.commandFlags = flags;
    this.roomName = args.room;

    try {
      // Show a progress signal early so E2E harnesses know the command is running
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Subscribing to presence in room: ${formatResource(this.roomName!)}`,
          ),
        );
      }

      // Try to create clients, but don't fail if auth fails
      try {
        this.chatClient = await this.createChatClient(flags);
      } catch (authError) {
        // Auth failed, but we still want to show the signal and wait
        this.logCliEvent(
          flags,
          "initialization",
          "authFailed",
          `Authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`,
        );
        if (!this.shouldOutputJson(flags)) {
          this.log(
            chalk.yellow(
              "Warning: Failed to connect to Ably (authentication failed)",
            ),
          );
        }

        // Wait for the duration even with auth failures
        await this.waitAndTrackCleanup(flags, "presence", flags.duration);
        return;
      }

      if (!this.chatClient) {
        // Don't exit immediately on auth failures - log the error but continue
        this.logCliEvent(
          flags,
          "initialization",
          "failed",
          "Failed to create Chat client - likely authentication issue",
        );
        if (!this.shouldOutputJson(flags)) {
          this.log(
            chalk.yellow(
              "Warning: Failed to connect to Ably (likely authentication issue)",
            ),
          );
        }

        // Wait for the duration even with auth failures
        await this.waitAndTrackCleanup(flags, "presence", flags.duration);
        return;
      }

      // Only proceed with actual functionality if auth succeeded
      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(this.roomName!);
      const currentRoom = this.room!;

      this.setupRoomStatusHandler(currentRoom, flags, {
        roomName: this.roomName!,
        successMessage: `Connected to room: ${formatResource(this.roomName!)}.`,
        listeningMessage: undefined,
      });

      await currentRoom.attach();

      if (!this.shouldOutputJson(flags) && this.roomName) {
        this.log(
          formatProgress(
            `Fetching current presence members for room ${formatResource(this.roomName)}`,
          ),
        );
        const members: PresenceMember[] = await currentRoom.presence.get();
        if (members.length === 0) {
          this.log(
            chalk.yellow("No members are currently present in this room."),
          );
        } else {
          this.log(
            `\n${formatHeading("Current presence members")} (${chalk.bold(members.length.toString())}):\n`,
          );
          for (const member of members) {
            this.log(`- ${formatClientId(member.clientId || "Unknown")}`);
            if (
              member.data &&
              typeof member.data === "object" &&
              Object.keys(member.data).length > 0
            ) {
              const profile = member.data as { name?: string };
              if (profile.name) {
                this.log(`  ${formatLabel("Name")} ${profile.name}`);
              }
              this.log(
                `  ${formatLabel("Full Profile Data")} ${this.formatJsonOutput({ data: member.data }, flags)}`,
              );
            }
          }
        }
      }

      this.logCliEvent(
        flags,
        "presence",
        "subscribingToEvents",
        "Subscribing to presence events",
      );
      currentRoom.presence.subscribe((event: PresenceEvent) => {
        const timestamp = new Date().toISOString();
        const member = event.member;
        const eventData = {
          eventType: event.type,
          member: { clientId: member.clientId, data: member.data },
          room: this.roomName,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "presence",
          event.type,
          `Presence event '${event.type}' received`,
          eventData,
        );
        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(eventData, flags);
        } else {
          const { symbol: actionSymbol, color: actionColor } =
            formatPresenceAction(event.type);
          this.log(
            `${formatTimestamp(timestamp)} ${actionColor(actionSymbol)} ${formatClientId(member.clientId || "Unknown")} ${actionColor(event.type)}`,
          );
          if (
            member.data &&
            typeof member.data === "object" &&
            Object.keys(member.data).length > 0
          ) {
            const profile = member.data as { name?: string };
            if (profile.name) {
              this.log(`  ${formatLabel("Name")} ${profile.name}`);
            }
            this.log(
              `  ${formatLabel("Full Data")} ${this.formatJsonOutput({ data: member.data }, flags)}`,
            );
          }
        }
      });
      this.logCliEvent(
        flags,
        "presence",
        "subscribedToEvents",
        "Subscribed to presence events",
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(
            `Subscribed to presence in room: ${formatResource(this.roomName!)}.`,
          ),
        );
        this.log(formatListening("Listening for presence events."));
      }

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomPresenceSubscribe", {
        room: this.roomName,
      });
    } finally {
      const currentFlags = this.commandFlags || {};
      this.logCliEvent(
        currentFlags,
        "presence",
        "finallyBlockReached",
        "Reached finally block for presence subscribe.",
      );

      if (!this.cleanupInProgress && !this.shouldOutputJson(currentFlags)) {
        this.logCliEvent(
          currentFlags,
          "presence",
          "implicitCleanupInFinally",
          "Performing cleanup (no prior signal).",
        );
      }
    }
  }
}
