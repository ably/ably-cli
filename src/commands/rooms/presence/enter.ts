import { ChatClient, Room, PresenceEvent, PresenceData } from "@ably/chat";
import { Args, Flags, Interfaces } from "@oclif/core";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import {
  formatSuccess,
  formatListening,
  formatResource,
  formatTimestamp,
  formatPresenceAction,
  formatIndex,
  formatClientId,
  formatLabel,
} from "../../../utils/output.js";

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
    "$ ably rooms presence enter my-room --show-others",
    "$ ably rooms presence enter my-room --duration 30",
    "$ ably rooms presence enter my-room --json",
  ];
  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,

    "show-others": Flags.boolean({
      default: false,
      description: "Show other presence events while present (default: false)",
    }),
    ...durationFlag,
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
      let trimmed = rawData.trim();
      // If the string is wrapped in single or double quotes (common when passed through a shell), remove them first.
      if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        trimmed = trimmed.slice(1, -1);
      }
      const parsed = this.parseJsonFlag(trimmed, "data", flags);
      this.data = parsed as PresenceData;
    }

    try {
      // Create clients
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient || !this.roomName) {
        this.fail(
          new Error("Failed to initialize chat client or room"),
          flags,
          "roomPresenceEnter",
        );
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(this.roomName);
      const currentRoom = this.room!;

      if (flags["show-others"]) {
        // Subscribe to room status changes only when showing others
        this.setupRoomStatusHandler(currentRoom, flags, {
          roomName: this.roomName,
          successMessage: `Connected to room: ${formatResource(this.roomName)}.`,
        });

        currentRoom.presence.subscribe((event: PresenceEvent) => {
          const member = event.member;
          if (member.clientId !== this.chatClient?.clientId) {
            this.sequenceCounter++;
            const timestamp = new Date().toISOString();
            const eventData = {
              eventType: event.type,
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
              this.logJsonEvent(eventData, flags);
            } else {
              const { symbol: actionSymbol, color: actionColor } =
                formatPresenceAction(event.type);
              const sequencePrefix = flags["sequence-numbers"]
                ? `${formatIndex(this.sequenceCounter)}`
                : "";
              this.log(
                `${formatTimestamp(timestamp)}${sequencePrefix} ${actionColor(actionSymbol)} ${formatClientId(member.clientId || "Unknown")} ${actionColor(event.type)}`,
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
          }
        });
      }

      await currentRoom.attach();
      this.logCliEvent(flags, "presence", "entering", "Entering presence", {
        data: this.data,
      });
      await currentRoom.presence.enter(this.data || {});
      this.logCliEvent(flags, "presence", "entered", "Entered presence");

      if (!this.shouldOutputJson(flags) && this.roomName) {
        this.log(
          formatSuccess(
            `Entered presence in room: ${formatResource(this.roomName)}.`,
          ),
        );
        if (flags["show-others"]) {
          this.log(`\n${formatListening("Listening for presence events.")}`);
        } else {
          this.log(`\n${formatListening("Staying present.")}`);
        }
      }

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomPresenceEnter", {
        room: this.roomName,
      });
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
          this.log(formatSuccess("Graceful shutdown complete."));
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
