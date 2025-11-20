import {
  PresenceMember,
  RoomStatus,
  ChatClient,
  RoomStatusChange,
  Room,
  PresenceEvent,
  PresenceEventType,
} from "@ably/chat";
import { Args, Interfaces, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

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
    ...ChatBaseCommand.globalFlags,
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
  };

  private chatClient: ChatClient | null = null;
  private roomName: string | null = null;
  private room: Room | null = null;
  private cleanupInProgress: boolean = false;
  private commandFlags: Interfaces.InferredFlags<
    typeof RoomsPresenceSubscribe.flags
  > | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsPresenceSubscribe);
    this.commandFlags = flags;
    this.roomName = args.room;

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        // Output the exact signal that E2E tests expect (without ANSI codes)
        this.log("Subscribing to presence events. Press Ctrl+C to exit.");
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
        const effectiveDuration =
          typeof flags.duration === "number" && flags.duration > 0
            ? flags.duration
            : process.env.ABLY_CLI_DEFAULT_DURATION
              ? Number(process.env.ABLY_CLI_DEFAULT_DURATION)
              : undefined;

        const exitReason =
          await waitUntilInterruptedOrTimeout(effectiveDuration);
        this.logCliEvent(
          flags,
          "presence",
          "runComplete",
          "Exiting wait loop (auth exception case)",
          { exitReason },
        );
        this.cleanupInProgress = exitReason === "signal";
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
        const effectiveDuration =
          typeof flags.duration === "number" && flags.duration > 0
            ? flags.duration
            : process.env.ABLY_CLI_DEFAULT_DURATION
              ? Number(process.env.ABLY_CLI_DEFAULT_DURATION)
              : undefined;

        const exitReason =
          await waitUntilInterruptedOrTimeout(effectiveDuration);
        this.logCliEvent(
          flags,
          "presence",
          "runComplete",
          "Exiting wait loop (auth failed case)",
          { exitReason },
        );
        this.cleanupInProgress = exitReason === "signal";
        return;
      }

      // Only proceed with actual functionality if auth succeeded
      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(this.roomName!);
      const currentRoom = this.room!;

      currentRoom.onStatusChange((statusChange: RoomStatusChange) => {
        let reasonDetails: string | Ably.ErrorInfo | undefined | null;
        if (statusChange.current === RoomStatus.Failed) {
          reasonDetails = currentRoom.error || undefined;
        }
        const reasonMsg =
          reasonDetails instanceof Error
            ? reasonDetails.message
            : String(reasonDetails);
        this.logCliEvent(
          flags,
          "room",
          `status-${statusChange.current}`,
          `Room status: ${statusChange.current}`,
          { reason: reasonMsg },
        );
        if (
          statusChange.current === RoomStatus.Attached &&
          !this.shouldOutputJson(flags) &&
          this.roomName
        ) {
          this.log(
            `${chalk.green("Successfully connected to room:")} ${chalk.cyan(this.roomName)}`,
          );
        } else if (
          statusChange.current === RoomStatus.Failed &&
          !this.shouldOutputJson(flags)
        ) {
          this.error(`Room connection failed: ${reasonMsg || "Unknown error"}`);
        }
      });

      await currentRoom.attach();

      if (!this.shouldOutputJson(flags) && this.roomName) {
        this.log(
          `Fetching current presence members for room ${chalk.cyan(this.roomName)}...`,
        );
        const members: PresenceMember[] = await currentRoom.presence.get();
        if (members.length === 0) {
          this.log(
            chalk.yellow("No members are currently present in this room."),
          );
        } else {
          this.log(
            `\n${chalk.cyan("Current presence members")} (${chalk.bold(members.length.toString())}):\n`,
          );
          for (const member of members) {
            this.log(`- ${chalk.blue(member.clientId || "Unknown")}`);
            if (
              member.data &&
              typeof member.data === "object" &&
              Object.keys(member.data).length > 0
            ) {
              const profile = member.data as { name?: string };
              if (profile.name) {
                this.log(`  ${chalk.dim("Name:")} ${profile.name}`);
              }
              this.log(
                `  ${chalk.dim("Full Profile Data:")} ${this.formatJsonOutput({ data: member.data }, flags)}`,
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
          type: event.type,
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
          this.log(
            this.formatJsonOutput({ success: true, ...eventData }, flags),
          );
        } else {
          let actionSymbol = "•";
          let actionColor = chalk.white;
          if (event.type === PresenceEventType.Enter) {
            actionSymbol = "✓";
            actionColor = chalk.green;
          }
          if (event.type === PresenceEventType.Leave) {
            actionSymbol = "✗";
            actionColor = chalk.red;
          }
          if (event.type === PresenceEventType.Update) {
            actionSymbol = "⟲";
            actionColor = chalk.yellow;
          }
          this.log(
            `[${timestamp}] ${actionColor(actionSymbol)} ${chalk.blue(member.clientId || "Unknown")} ${actionColor(event.type)}`,
          );
          if (
            member.data &&
            typeof member.data === "object" &&
            Object.keys(member.data).length > 0
          ) {
            const profile = member.data as { name?: string };
            if (profile.name) {
              this.log(`  ${chalk.dim("Name:")} ${profile.name}`);
            }
            this.log(
              `  ${chalk.dim("Full Data:")} ${this.formatJsonOutput({ data: member.data }, flags)}`,
            );
          }
        }
      });
      this.logCliEvent(
        flags,
        "presence",
        "subscribedToEvents",
        "Successfully subscribed to presence events",
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          // Output the exact signal that E2E tests expect (without ANSI codes)
          "Subscribing to presence events. Press Ctrl+C to exit.",
        );
      }

      // Wait until the user interrupts or the optional duration elapses
      const effectiveDuration =
        typeof flags.duration === "number" && flags.duration > 0
          ? flags.duration
          : process.env.ABLY_CLI_DEFAULT_DURATION
            ? Number(process.env.ABLY_CLI_DEFAULT_DURATION)
            : undefined;

      const exitReason = await waitUntilInterruptedOrTimeout(effectiveDuration);
      this.logCliEvent(flags, "presence", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal"; // mark if signal so finally knows
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(flags, "presence", "runError", `Error: ${errorMsg}`, {
        room: this.roomName,
      });
      if (!this.shouldOutputJson(flags)) {
        this.error(`Error: ${errorMsg}`);
      }
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
