import { ChatClient } from "@ably/chat";
import { Args, Flags } from "@oclif/core";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import { formatResource } from "../../../utils/output.js";

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
    roomName: Args.string({
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
        return this.fail(
          "Failed to initialize clients",
          flags,
          "roomTypingKeystroke",
        );
      }

      const { roomName } = args;

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

      // Subscribe to room status changes
      const { failurePromise } = this.setupRoomStatusHandler(room, flags, {
        roomName,
      });

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${roomName}`,
      );
      await room.attach();

      // Start typing
      this.logCliEvent(
        flags,
        "typing",
        "startAttempt",
        "Attempting to start typing...",
      );
      await room.typing.keystroke();
      this.logCliEvent(flags, "typing", "started", "Started typing");

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            typing: {
              room: roomName,
              isTyping: true,
              autoType: Boolean(flags["auto-type"]),
            },
          },
          flags,
        );
      }

      this.logSuccessMessage(
        `Started typing in room: ${formatResource(roomName)}.`,
        flags,
      );
      if (flags["auto-type"]) {
        this.logListening(
          "Will automatically remain typing until terminated.",
          flags,
        );
      } else if (!this.shouldOutputJson(flags)) {
        this.log(
          "Sent a single typing indicator. Use --auto-type to keep typing automatically.",
        );
      }

      // Keep typing active by calling keystroke() periodically if autoType is enabled
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

        this.logCliEvent(
          flags,
          "typing",
          "listening",
          "Maintaining typing status...",
        );

        // Wait until the user interrupts, duration elapses, or the room fails
        await Promise.race([
          this.waitAndTrackCleanup(flags, "typing", flags.duration),
          failurePromise,
        ]);
      } else {
        // Suppress unhandled rejection — failurePromise exists from setupRoomStatusHandler
        failurePromise.catch(() => {});
      }
    } catch (error) {
      this.fail(error, flags, "roomTypingKeystroke", { room: args.roomName });
    }
  }
}
