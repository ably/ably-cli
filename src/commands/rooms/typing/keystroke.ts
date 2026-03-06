import { RoomStatus, ChatClient } from "@ably/chat";
import { Args, Flags } from "@oclif/core";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";
import { listening, resource, success } from "../../../utils/output.js";

// The heartbeats are throttled to one every 10 seconds. There's a 2 second
// leeway to send a keystroke/heartbeat after the 10 second mark so the
// typing indicator won't flicker for others. The 2 second leeway is at the
// recipient side, we have 2 second window to publish the heartbeat and it
// should also arrive within this interval.
//
// The best thing to do to keep the indicator on is to keystroke() often.
const KEYSTROKE_INTERVAL = 450; // ms

export default class TypingKeystroke extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room to start typing in",
      required: true,
    }),
  };

  static override description =
    "Send a typing indicator in an Ably Chat room (use --auto-type to keep typing automatically until terminated)";

  static override examples = [
    "$ ably rooms typing keystroke my-room",
    "$ ably rooms typing keystroke my-room --auto-type",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms typing keystroke my-room',
    "$ ably rooms typing keystroke my-room --json",
    "$ ably rooms typing keystroke my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    "auto-type": Flags.boolean({
      description: "Automatically keep typing indicator active",
      default: false,
    }),
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;
  private typingIntervalId: NodeJS.Timeout | null = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    if (this.typingIntervalId) {
      clearInterval(this.typingIntervalId);
      this.typingIntervalId = null;
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TypingKeystroke);

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags);
      if (!this.chatClient) {
        this.error("Failed to initialize clients");
        return;
      }

      const { room: roomName } = args;

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      // Get the room with typing enabled
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${roomName}`,
      );
      const room = await this.chatClient.rooms.get(roomName);
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${roomName}`,
      );

      // Subscribe to room status changes — combines logging and keystroke trigger
      room.onStatusChange((statusChange) => {
        let reason: Error | null | string | undefined;
        if (statusChange.current === RoomStatus.Failed) {
          reason = room.error;
        }
        const reasonMsg = reason instanceof Error ? reason.message : reason;
        this.logCliEvent(
          flags,
          "room",
          `status-${statusChange.current}`,
          `Room status changed to ${statusChange.current}`,
          { reason: reasonMsg, room: roomName },
        );

        if (statusChange.current === RoomStatus.Attached) {
          if (!this.shouldOutputJson(flags)) {
            this.log(success(`Connected to room: ${resource(roomName)}.`));
          }

          // Start typing immediately
          this.logCliEvent(
            flags,
            "typing",
            "startAttempt",
            "Attempting to start typing...",
          );
          room.typing
            .keystroke()
            .then(() => {
              this.logCliEvent(flags, "typing", "started", "Started typing");
              if (!this.shouldOutputJson(flags)) {
                this.log(
                  success(`Started typing in room: ${resource(roomName)}.`),
                );
                if (flags["auto-type"]) {
                  this.log(
                    listening(
                      "Will automatically remain typing until terminated.",
                    ),
                  );
                } else {
                  this.log(
                    listening(
                      "Sent a single typing indicator. Use --auto-type to keep typing automatically.",
                    ),
                  );
                }
              }

              // Keep typing active by calling keystroke() periodically if autoType is enabled
              if (this.typingIntervalId) clearInterval(this.typingIntervalId);

              if (flags["auto-type"]) {
                this.typingIntervalId = setInterval(() => {
                  room.typing.keystroke().catch((error: Error) => {
                    this.logCliEvent(
                      flags,
                      "typing",
                      "startErrorPeriodic",
                      `Error refreshing typing state: ${error.message}`,
                      { error: error.message },
                    );
                  });
                }, KEYSTROKE_INTERVAL);
              }
            })
            .catch((error: Error) => {
              this.logCliEvent(
                flags,
                "typing",
                "startErrorInitial",
                `Failed to start typing initially: ${error.message}`,
                { error: error.message },
              );
              if (!this.shouldOutputJson(flags)) {
                this.error(`Failed to start typing: ${error.message}`);
              }
            });
        } else if (
          statusChange.current === RoomStatus.Failed &&
          !this.shouldOutputJson(flags)
        ) {
          this.error(
            `Failed to attach to room ${roomName}: ${reasonMsg || "Unknown error"}`,
          );
        }
      });

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${roomName}`,
      );
      await room.attach();
      // Successful attach and initial typing start logged by onStatusChange handler

      this.logCliEvent(
        flags,
        "typing",
        "listening",
        "Maintaining typing status...",
      );

      // Decide how long to remain connected
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      this.handleCommandError(error, flags, "typing", { room: args.room });
    }
  }
}
