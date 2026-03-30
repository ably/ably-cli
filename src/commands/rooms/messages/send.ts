import { Args, Flags } from "@oclif/core";
import { ChatClient, JsonObject } from "@ably/chat";

import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { interpolateMessage } from "../../../utils/message.js";
import {
  formatProgress,
  formatSuccess,
  formatResource,
} from "../../../utils/output.js";

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
  serial?: string;
  success: boolean;
  error?: string;
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
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms messages send my-room "Welcome to the chat!"',
    '$ ably rooms messages send --metadata \'{"isImportant":true}\' my-room "Attention please!"',
    '$ ably rooms messages send --count 5 my-room "Message number {{.Count}}"',
    '$ ably rooms messages send --count 10 --delay 1000 my-room "Message at {{.Timestamp}}"',
    '$ ably rooms messages send my-room "Hello World!" --json',
    '$ ably rooms messages send my-room "Hello World!" --pretty-json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    count: Flags.integer({
      char: "c",
      default: 1,
      description: "Number of messages to send",
      min: 1,
    }),
    delay: Flags.integer({
      char: "d",
      default: 40,
      description: "Delay between messages in milliseconds (max 25 msgs/sec)",
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

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags, { restOnly: true });

      if (!this.chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomMessageSend",
        );
      }

      // Parse metadata if provided
      let metadata: JsonObject | undefined;
      if (flags.metadata) {
        const parsedMetadata = this.parseJsonFlag(
          flags.metadata,
          "metadata",
          flags,
        );
        if (
          typeof parsedMetadata !== "object" ||
          parsedMetadata === null ||
          Array.isArray(parsedMetadata)
        ) {
          this.fail("Metadata must be a JSON object", flags, "roomMessageSend");
        }

        metadata = parsedMetadata as JsonObject;

        this.logCliEvent(
          flags,
          "message",
          "metadataParsed",
          "Message metadata parsed",
          { metadata },
        );
      }

      const room = await this.chatClient.rooms.get(args.room);

      const count = flags.count;
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
        this.log(
          formatProgress(`Sending ${count} messages with ${delay}ms delay`),
        );
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
          const interpolatedText = interpolateMessage(args.text, i + 1);
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
                `Message ${i + 1} sent`,
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
              const errorMsg = errorMessage(error);
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

        const finalResult = {
          send: {
            errors: errorCount,
            results,
            sent: sentCount,
            allSucceeded: errorCount === 0,
            total: count,
          },
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
            this.logJsonResult(finalResult, flags);
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
              formatSuccess(
                `${sentCount}/${count} messages sent to room ${formatResource(args.room)} (${errorCount} errors).`,
              ),
            );
          }
        }
      } else {
        // Single message
        try {
          // Apply interpolation to the message
          const interpolatedText = interpolateMessage(args.text, 1);
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
          const sentMessage = await room.messages.send(messageToSend);
          const result: MessageResult = {
            message: messageToSend,
            room: args.room,
            serial: sentMessage.serial,
            success: true,
          };
          this.logCliEvent(
            flags,
            "message",
            "singleSendComplete",
            "Message sent",
            result,
          );

          if (!this.shouldSuppressOutput(flags)) {
            if (this.shouldOutputJson(flags)) {
              this.logJsonResult(
                {
                  message: {
                    ...messageToSend,
                    room: args.room,
                    serial: sentMessage.serial,
                  },
                },
                flags,
              );
            } else {
              this.log(
                formatSuccess(
                  `Message sent to room ${formatResource(args.room)}.`,
                ),
              );
              this.log(`  Serial: ${formatResource(sentMessage.serial)}`);
            }
          }
        } catch (error) {
          this.fail(error, flags, "roomMessageSend", {
            room: args.room,
          });
        }
      }
    } catch (error) {
      this.fail(error, flags, "roomMessageSend");
    }
  }
}
