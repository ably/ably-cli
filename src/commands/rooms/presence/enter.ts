import {
  ChatClient,
  Room,
  RoomStatus,
  RoomStatusChange,
  PresenceEvent,
  PresenceEventType,
  PresenceData,
} from "@ably/chat";
import { Args, Flags, Interfaces } from "@oclif/core";
import chalk from "chalk";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

export default class RoomsPresenceEnter extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to enter presence on",
      required: true,
    }),
  };

  static override description =
    "Enter presence in a chat room and remain present until terminated";
  static override examples = [
    "$ ably rooms presence enter my-room",
    `$ ably rooms presence enter my-room --data '{"name":"User","status":"active"}'`,
    "$ ably rooms presence enter my-room --duration 30",
  ];
  static override flags = {
    ...ChatBaseCommand.globalFlags,

    "show-others": Flags.boolean({
      default: true,
      description: "Show other presence events while present (default: true)",
    }),
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
    data: Flags.string({
      description: "Data to include with the member (JSON format)",
      required: false,
    }),
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
  };

  private chatClient: ChatClient | null = null;
  private room: Room | null = null;
  private roomName: string | null = null;
  private data: PresenceData | null = null;

  private cleanupInProgress: boolean = false;
  private commandFlags: Interfaces.InferredFlags<
    typeof RoomsPresenceEnter.flags
  > | null = null;
  private sequenceCounter = 0;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsPresenceEnter);
    this.commandFlags = flags;
    this.roomName = args.room;

    const rawData = flags.data;
    if (rawData && rawData !== "{}") {
      try {
        let trimmed = rawData.trim();
        // If the string is wrapped in single or double quotes (common when passed through a shell), remove them first.
        if (
          (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
          (trimmed.startsWith('"') && trimmed.endsWith('"'))
        ) {
          trimmed = trimmed.slice(1, -1);
        }
        this.data = JSON.parse(trimmed);
      } catch (error) {
        this.error(
          `Invalid data JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
        return; // Exit early if JSON is invalid
      }
    }

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log(`${chalk.dim("Staying present. Press Ctrl+C to exit.")}`);
      }

      // Create clients
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient || !this.roomName) {
        this.error("Failed to initialize chat client or room");
        return;
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(this.roomName);
      const currentRoom = this.room!;

      if (flags["show-others"]) {
        currentRoom.onStatusChange((statusChange: RoomStatusChange) => {
          let reasonToLog: string | undefined;
          if (statusChange.current === RoomStatus.Failed) {
            const roomError = this.room?.error;
            reasonToLog =
              roomError instanceof Error
                ? roomError.message
                : String(roomError);
            this.logCliEvent(
              flags,
              "room",
              `status-failed-detail`,
              `Room status is FAILED. Error: ${reasonToLog}`,
              { error: roomError },
            );
            if (!this.shouldOutputJson(flags)) {
              this.error(
                `Room connection failed: ${reasonToLog || "Unknown error"}`,
              );
            }
          } else if (
            statusChange.current === RoomStatus.Attached &&
            !this.shouldOutputJson(flags) &&
            this.roomName
          ) {
            this.log(
              `${chalk.green("Successfully connected to room:")} ${chalk.cyan(this.roomName)}`,
            );
          } else {
            this.logCliEvent(
              flags,
              "room",
              `status-${statusChange.current}`,
              `Room status: ${statusChange.current}`,
            );
          }
        });

        currentRoom.presence.subscribe((event: PresenceEvent) => {
          const member = event.member;
          if (member.clientId !== this.chatClient?.clientId) {
            this.sequenceCounter++;
            const timestamp = new Date().toISOString();
            const eventData = {
              type: event.type,
              member: { clientId: member.clientId, data: member.data },
              room: this.roomName,
              timestamp,
              ...(flags["sequence-numbers"]
                ? { sequence: this.sequenceCounter }
                : {}),
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
              const sequencePrefix = flags["sequence-numbers"]
                ? `${chalk.dim(`[${this.sequenceCounter}]`)}`
                : "";
              this.log(
                `[${timestamp}]${sequencePrefix} ${actionColor(actionSymbol)} ${chalk.blue(member.clientId || "Unknown")} ${actionColor(event.type)}`,
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
          }
        });
      }

      await currentRoom.attach();
      this.logCliEvent(flags, "presence", "entering", "Entering presence", {
        data: this.data,
      });
      await currentRoom.presence.enter(this.data || {});
      this.logCliEvent(
        flags,
        "presence",
        "entered",
        "Entered presence successfully",
      );

      if (!this.shouldOutputJson(flags) && this.roomName) {
        // Output the exact signal that E2E tests expect (without ANSI codes)
        this.log(
          `✓ Entered room ${this.roomName} as ${this.chatClient?.clientId || "Unknown"}`,
        );
        if (flags["show-others"]) {
          this.log(
            `\n${chalk.dim("Listening for presence events. Press Ctrl+C to exit.")}`,
          );
        } else {
          this.log(`\n${chalk.dim("Staying present. Press Ctrl+C to exit.")}`);
        }
      }

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
      this.logCliEvent(flags, "presence", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal"; // mark if signal so finally knows
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "presence",
        "runError",
        `Error during command execution: ${errorMsg}`,
        { errorDetails: error },
      );
      if (!this.shouldOutputJson(flags)) {
        this.error(`Execution Error: ${errorMsg}`);
      }

      // Don't force exit on errors - let the command handle cleanup naturally
      return;
    } finally {
      const currentFlags = this.commandFlags || flags || {};
      this.logCliEvent(
        currentFlags,
        "presence",
        "finallyBlockReached",
        "Reached finally block for cleanup.",
      );

      if (!this.cleanupInProgress && !this.shouldOutputJson(currentFlags)) {
        this.logCliEvent(
          currentFlags,
          "presence",
          "implicitCleanupInFinally",
          "Performing cleanup in finally (no prior signal or natural end).",
        );
      } else {
        // Either cleanup is in progress or we're in JSON mode
        this.logCliEvent(
          currentFlags,
          "presence",
          "explicitCleanupOrJsonMode",
          "Cleanup already in progress or JSON output mode",
        );
      }

      if (!this.shouldOutputJson(currentFlags)) {
        if (this.cleanupInProgress) {
          this.log(chalk.green("Graceful shutdown complete (user interrupt)."));
        } else {
          // Normal completion without user interrupt
          this.logCliEvent(
            currentFlags,
            "presence",
            "completedNormally",
            "Command completed normally",
          );
        }
      }
    }
  }
}
