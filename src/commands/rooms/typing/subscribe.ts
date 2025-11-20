import { ChatClient, RoomStatus, RoomStatusChange } from "@ably/chat";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";

export default class TypingSubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room to subscribe to typing indicators from",
      required: true,
    }),
  };

  static override description =
    "Subscribe to typing indicators in an Ably Chat room";

  static override examples = [
    "$ ably rooms typing subscribe my-room",
    '$ ably rooms typing subscribe --api-key "YOUR_API_KEY" my-room',
    "$ ably rooms typing subscribe my-room --json",
    "$ ably rooms typing subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...ChatBaseCommand.globalFlags,
  };

  private chatClient: ChatClient | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TypingSubscribe);

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
      const room = await this.chatClient.rooms.get(roomName, {});
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${roomName}`,
      );

      // Subscribe to room status changes
      this.logCliEvent(
        flags,
        "room",
        "subscribingToStatus",
        "Subscribing to room status changes",
      );
      room.onStatusChange((statusChange: RoomStatusChange) => {
        let reason: Error | null | string | undefined;
        if (statusChange.current === RoomStatus.Failed) {
          reason = room.error; // Get reason from room.error on failure
        }

        const reasonMsg = reason instanceof Error ? reason.message : reason;
        this.logCliEvent(
          flags,
          "room",
          `status-${statusChange.current}`,
          `Room status changed to ${statusChange.current}`,
          { reason: reasonMsg },
        );

        if (statusChange.current === RoomStatus.Attached) {
          if (!this.shouldOutputJson(flags)) {
            this.log(
              `${chalk.green("Connected to room:")} ${chalk.bold(roomName)}`,
            );
            this.log(
              `${chalk.dim("Listening for typing indicators. Press Ctrl+C to exit.")}`,
            );
          }
        } else if (
          statusChange.current === RoomStatus.Failed &&
          !this.shouldOutputJson(flags)
        ) {
          this.error(
            `Failed to attach to room: ${reasonMsg || "Unknown error"}`,
          );
        }
      });
      this.logCliEvent(
        flags,
        "room",
        "subscribedToStatus",
        "Successfully subscribed to room status changes",
      );

      // Set up typing indicators
      this.logCliEvent(
        flags,
        "typing",
        "subscribing",
        "Subscribing to typing indicators",
      );
      room.typing.subscribe((typingSetEvent) => {
        const timestamp = new Date().toISOString();
        const currentlyTyping = [...(typingSetEvent.currentlyTyping || [])];
        const eventData = {
          currentlyTyping,
          room: roomName,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "typing",
          "update",
          "Typing status update received",
          eventData,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput({ success: true, ...eventData }, flags),
          );
        } else {
          // Clear-line updates are helpful in an interactive TTY but they make
          // the mocha output hard to read when the CLI is invoked from unit
          // tests (ABLY_CLI_TEST_MODE=true) or when stdout is not a TTY (CI).
          const shouldInlineUpdate = this.shouldUseTerminalUpdates();

          if (shouldInlineUpdate) {
            // Clear the current line and rewrite it in-place.
            process.stdout.write("\r\u001B[K");

            if (currentlyTyping.length > 0) {
              const memberNames = currentlyTyping.join(", ");
              process.stdout.write(
                chalk.yellow(
                  `${memberNames} ${currentlyTyping.length === 1 ? "is" : "are"} typing...`,
                ),
              );
            }
          } else if (currentlyTyping.length > 0) {
            // Fallback: just log a new line so that test output remains intact.
            const memberNames = currentlyTyping.join(", ");
            this.log(
              chalk.yellow(
                `${memberNames} ${currentlyTyping.length === 1 ? "is" : "are"} typing...`,
              ),
            );
          }
        }
      });
      this.logCliEvent(
        flags,
        "typing",
        "subscribed",
        "Successfully subscribed to typing indicators",
      );

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${roomName}`,
      );
      await room.attach();
      // Successful attach logged by onStatusChange handler

      this.logCliEvent(
        flags,
        "typing",
        "listening",
        "Listening for typing indicators...",
      );
      // Keep the process running until Ctrl+C
      await new Promise<void>((resolve) => {
        // This promise intentionally never resolves
        process.on("SIGINT", async () => {
          this.logCliEvent(
            flags,
            "typing",
            "cleanupInitiated",
            "Cleanup initiated (Ctrl+C pressed)",
          );
          if (!this.shouldOutputJson(flags)) {
            // Move to a new line to not override typing status
            this.log("\n");
            this.log(`${chalk.yellow("Disconnecting from room...")}`);
          }

          if (!this.shouldOutputJson(flags)) {
            this.log(`${chalk.green("Successfully disconnected.")}`);
          }

          resolve();
        });
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "typing",
        "fatalError",
        `Failed to subscribe to typing indicators: ${errorMsg}`,
        { error: errorMsg, room: args.room },
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            { error: errorMsg, room: args.room, success: false },
            flags,
          ),
        );
      } else {
        this.error(`Failed to subscribe to typing indicators: ${errorMsg}`);
      }
    }
  }
}
