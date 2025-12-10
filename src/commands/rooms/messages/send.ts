import { Args, Flags } from "@oclif/core";
import { ChatClient, ConnectionStatusChange, JsonObject } from "@ably/chat";

import { ChatBaseCommand } from "../../../chat-base-command.js";

// Define interfaces for the message send command
interface MessageToSend {
  text: string;
  metadata?: JsonObject;
  [key: string]: unknown;
}

interface MessageResult {
  index?: number;
  message?: MessageToSend;
  room: string;
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

interface FinalResult {
  errors: number;
  results: MessageResult[];
  sent: number;
  success: boolean;
  total: number;
  [key: string]: unknown;
}

export default class MessagesSend extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room to send the message to",
      required: true,
    }),
    text: Args.string({
      description: "The message text to send",
      required: true,
    }),
  };

  static override description = "Send a message to an Ably Chat room";

  static override examples = [
    '$ ably rooms messages send my-room "Hello World!"',
    '$ ably rooms messages send --api-key "YOUR_API_KEY" my-room "Welcome to the chat!"',
    '$ ably rooms messages send --metadata \'{"isImportant":true}\' my-room "Attention please!"',
    '$ ably rooms messages send --count 5 my-room "Message number {{.Count}}"',
    '$ ably rooms messages send --count 10 --delay 1000 my-room "Message at {{.Timestamp}}"',
    '$ ably rooms messages send my-room "Hello World!" --json',
    '$ ably rooms messages send my-room "Hello World!" --pretty-json',
  ];

  static override flags = {
    ...ChatBaseCommand.globalFlags,
    count: Flags.integer({
      char: "c",
      default: 1,
      description: "Number of messages to send (default: 1)",
    }),
    delay: Flags.integer({
      char: "d",
      default: 40,
      description:
        "Delay between messages in milliseconds (default: 40ms, max 25 msgs/sec)",
    }),
    metadata: Flags.string({
      description: "Additional metadata for the message (JSON format)",
    }),
  };

  private progressIntervalId: NodeJS.Timeout | null = null;
  private chatClient: ChatClient | null = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesSend);

    if (!args.room) {
      throw new Error("Room ID is required");
    }

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.error("Failed to create Chat client");
        return;
      }

      // Add listeners for connection state changes
      this.chatClient.connection.onStatusChange(
        (stateChange: ConnectionStatusChange) => {
          this.logCliEvent(
            flags,
            "connection",
            stateChange.current,
            `Realtime connection state changed to ${stateChange.current}`,
            { error: stateChange.error },
          );
        },
      );

      // Parse metadata if provided
      let metadata;
      if (flags.metadata) {
        try {
          metadata = JSON.parse(flags.metadata);
          this.logCliEvent(
            flags,
            "message",
            "metadataParsed",
            "Message metadata parsed successfully",
            { metadata },
          );
        } catch (error) {
          const errorMsg = `Invalid metadata JSON: ${error instanceof Error ? error.message : String(error)}`;
          this.logCliEvent(flags, "message", "metadataParseError", errorMsg, {
            error: errorMsg,
          });
          if (this.shouldOutputJson(flags)) {
            this.jsonError({ error: errorMsg, success: false }, flags);
          } else {
            this.error(errorMsg);
          }

          return;
        }
      }

      // Get the room with default options
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${args.room}`,
      );
      const room = await this.chatClient.rooms.get(args.room);
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${args.room}`,
      );

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${args.room}`,
      );
      await room.attach();
      this.logCliEvent(
        flags,
        "room",
        "attached",
        `Successfully attached to room ${args.room}`,
      );

      // Validate count and delay
      const count = Math.max(1, flags.count);
      let { delay } = flags;

      // Enforce minimum delay when sending multiple messages
      if (count > 1 && delay < 40) {
        delay = 40;
        this.logCliEvent(
          flags,
          "message",
          "minDelayEnforced",
          "Using minimum delay of 40ms for multiple messages",
          { delay },
        );
      }

      // If sending multiple messages, show a progress indication
      this.logCliEvent(
        flags,
        "message",
        "startingSend",
        `Sending ${count} messages with ${delay}ms delay...`,
        { count, delay },
      );
      if (count > 1 && !this.shouldOutputJson(flags)) {
        this.log(`Sending ${count} messages with ${delay}ms delay...`);
      }

      // Track send progress
      let sentCount = 0;
      let errorCount = 0;
      const results: MessageResult[] = [];

      // Send messages
      if (count > 1) {
        // Sending multiple messages
        this.progressIntervalId = this.shouldOutputJson(flags)
          ? setInterval(() => {
              this.logCliEvent(
                flags,
                "message",
                "progress",
                "Sending messages",
                {
                  errors: errorCount,
                  sent: sentCount,
                  total: count,
                },
              );
            }, 2000)
          : setInterval(() => {
              this.log(
                `Progress: ${sentCount}/${count} messages sent (${errorCount} errors)`,
              );
            }, 1000);

        for (let i = 0; i < count; i++) {
          // Apply interpolation to the message
          const interpolatedText = this.interpolateMessage(args.text, i + 1);
          const messageToSend: MessageToSend = {
            text: interpolatedText,
            ...(metadata ? { metadata } : {}),
          };
          this.logCliEvent(
            flags,
            "message",
            "sending",
            `Attempting to send message ${i + 1}`,
            { index: i + 1, message: messageToSend },
          );

          // Send the message without awaiting
          room.messages
            .send(messageToSend)
            .then(() => {
              sentCount++;
              const result: MessageResult = {
                index: i + 1,
                message: messageToSend,
                room: args.room,
                success: true,
              };
              results.push(result);
              this.logCliEvent(
                flags,
                "message",
                "sentSuccess",
                `Message ${i + 1} sent successfully`,
                { index: i + 1 },
              );

              if (
                !this.shouldSuppressOutput(flags) &&
                !this.shouldOutputJson(flags)
              ) {
                // Logged implicitly by progress interval
              }
            })
            .catch((error: unknown) => {
              errorCount++;
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              const result: MessageResult = {
                error: errorMsg,
                index: i + 1,
                room: args.room,
                success: false,
              };
              results.push(result);
              this.logCliEvent(
                flags,
                "message",
                "sendError",
                `Error sending message ${i + 1}: ${errorMsg}`,
                { error: errorMsg, index: i + 1 },
              );
              process.exitCode = 1;

              if (
                !this.shouldSuppressOutput(flags) &&
                !this.shouldOutputJson(flags)
              ) {
                // Logged implicitly by progress interval
              }
            });

          // Delay before sending next message if not the last one
          if (i < count - 1 && delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        // Wait for all sends to complete (or timeout after a reasonable period)
        const maxWaitTime = Math.max(5000, count * delay * 2); // At least 5 seconds or twice the expected duration
        const startWaitTime = Date.now();

        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (
              sentCount + errorCount >= count ||
              Date.now() - startWaitTime > maxWaitTime
            ) {
              if (this.progressIntervalId)
                clearInterval(this.progressIntervalId);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });

        const finalResult: FinalResult = {
          errors: errorCount,
          results,
          sent: sentCount,
          success: errorCount === 0,
          total: count,
        };
        this.logCliEvent(
          flags,
          "message",
          "multiSendComplete",
          `Finished sending ${count} messages`,
          finalResult,
        );

        if (!this.shouldSuppressOutput(flags)) {
          if (this.shouldOutputJson(flags)) {
            this.log(this.formatJsonOutput(finalResult, flags));
          } else {
            // Clear the last progress line before final summary in an interactive
            // terminal. Avoid this in test mode or non-TTY environments as it
            // makes captured output hard to read.
            if (this.shouldUseTerminalUpdates()) {
              process.stdout.write(
                "\r" + " ".repeat(process.stdout.columns) + "\r",
              );
            }
            this.log(
              `${sentCount}/${count} messages sent successfully (${errorCount} errors).`,
            );
          }
        }
      } else {
        // Single message
        try {
          // Apply interpolation to the message
          const interpolatedText = this.interpolateMessage(args.text, 1);
          const messageToSend: MessageToSend = {
            text: interpolatedText,
            ...(metadata ? { metadata } : {}),
          };
          this.logCliEvent(
            flags,
            "message",
            "sending",
            "Attempting to send single message",
            { message: messageToSend },
          );

          // Send the message
          await room.messages.send(messageToSend);
          const result: MessageResult = {
            message: messageToSend,
            room: args.room,
            success: true,
          };
          this.logCliEvent(
            flags,
            "message",
            "singleSendComplete",
            "Message sent successfully",
            result,
          );

          if (!this.shouldSuppressOutput(flags)) {
            if (this.shouldOutputJson(flags)) {
              this.log(this.formatJsonOutput(result, flags));
            } else {
              this.log("Message sent successfully.");
            }
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const result: MessageResult = {
            error: errorMsg,
            room: args.room,
            success: false,
          };
          this.logCliEvent(
            flags,
            "message",
            "singleSendError",
            `Failed to send message: ${errorMsg}`,
            { error: errorMsg },
          );
          if (this.shouldOutputJson(flags)) {
            this.jsonError(result, flags);
            return;
          } else {
            this.error(`Failed to send message: ${errorMsg}`);
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "message",
        "fatalError",
        `Failed to send message: ${errorMsg}`,
        { error: errorMsg },
      );
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(`Failed to send message: ${errorMsg}`);
      }
    }
  }

  private interpolateMessage(message: string, count: number): string {
    // Replace {{.Count}} with the current count
    let result = message.replaceAll("{{.Count}}", count.toString());

    // Replace {{.Timestamp}} with the current timestamp
    result = result.replaceAll("{{.Timestamp}}", Date.now().toString());

    return result;
  }
}
