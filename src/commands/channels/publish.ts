import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../flags.js";
import { BaseFlags } from "../../types/cli.js";
import { errorMessage } from "../../utils/errors.js";
import { prepareMessageFromInput } from "../../utils/message.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../utils/output.js";
import { chunkText } from "../../utils/text-chunker.js";

export default class ChannelsPublish extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name to publish to",
      required: true,
    }),
    message: Args.string({
      description: "The message to publish (JSON format or plain text)",
      required: true,
    }),
  };

  static override description = "Publish a message to an Ably channel";

  static override examples = [
    '$ ably channels publish my-channel \'{"name":"event","data":"Hello World"}\'',
    '$ ably channels publish --name event my-channel \'{"text":"Hello World"}\'',
    '$ ably channels publish my-channel "Hello World"',
    '$ ably channels publish --name event my-channel "Plain text message"',
    '$ ably channels publish --count 5 my-channel "Message number {{.Count}}"',
    '$ ably channels publish --count 10 --delay 1000 my-channel "Message at {{.Timestamp}}"',
    '$ ably channels publish --transport realtime my-channel "Using realtime transport"',
    '$ ably channels publish my-channel "Hello World" --json',
    '$ ably channels publish my-channel "Hello World" --pretty-json',
    '$ ably channels publish my-channel \'{"data":"Push notification","extras":{"push":{"notification":{"title":"Hello","body":"World"}}}}\'',
    '$ ably channels publish my-channel "The quick brown fox jumps over the lazy dog" --token-streaming --stream-duration 5',
    '$ ably channels publish --name ai-response my-channel "The quick brown fox" --token-streaming',
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels publish my-channel \'{"data":"Simple message"}\'',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    "token-size": Flags.integer({
      default: 4,
      dependsOn: ["token-streaming"],
      description: "Approximate characters per token",
      min: 1,
    }),
    count: Flags.integer({
      char: "c",
      default: 1,
      description: "Number of messages to publish (default: 1)",
    }),
    delay: Flags.integer({
      char: "d",
      default: 40,
      description:
        "Delay between messages in milliseconds (default: 40ms, max 25 msgs/sec)",
    }),
    encoding: Flags.string({
      char: "e",
      description: "The encoding for the message",
    }),
    name: Flags.string({
      char: "n",
      description: "The event name (if not specified in the message JSON)",
    }),
    "stream-duration": Flags.integer({
      default: 10,
      dependsOn: ["token-streaming"],
      description: "Total duration in seconds over which to stream tokens",
      min: 1,
    }),
    "token-streaming": Flags.boolean({
      default: false,
      description:
        "Enable token streaming: publish initial message then stream remaining text as appends (message-per-response pattern)",
      exclusive: ["transport"],
    }),
    transport: Flags.string({
      description: "Transport method to use for publishing (rest or realtime)",
      options: ["rest", "realtime"],
    }),
  };

  private progressIntervalId: NodeJS.Timeout | null = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }

    // Client cleanup is handled by base class
    return super.finally(err);
  }

  // --- Refactored Publish Logic ---

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPublish);

    // Validate --token-streaming mutual exclusivity with --count > 1
    if (flags["token-streaming"] && flags.count > 1) {
      this.fail(
        "Cannot use --token-streaming with --count > 1",
        flags,
        "channelPublish",
      );
    }

    // Stream text mode always uses realtime
    if (flags["token-streaming"]) {
      await this.publishTokenStream(args, flags);
      return;
    }

    // Use Realtime transport by default when publishing multiple messages to ensure ordering
    // If transport is not explicitly set and count > 1, use realtime
    // If transport is explicitly set, respect that choice
    const shouldUseRealtime =
      flags.transport === "realtime" || (!flags.transport && flags.count > 1);

    await (shouldUseRealtime
      ? this.publishWithRealtime(args, flags)
      : this.publishWithRest(args, flags));
  }

  private clearProgressIndicator(): void {
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
  }

  // --- Original Methods (modified) ---

  private logFinalSummary(
    flags: Record<string, unknown>,
    total: number,
    published: number,
    errors: number,
    results: Array<Record<string, unknown>>,
    args: Record<string, unknown>,
  ): void {
    const finalResult = {
      errors,
      published,
      results,
      allSucceeded: errors === 0 && published === total,
      total,
      channel: args.channel,
    };
    const eventType =
      total > 1 ? "multiPublishComplete" : "singlePublishComplete";
    const eventMessage =
      total > 1
        ? `Published ${total} messages to channel ${args.channel}`
        : `Published message to channel ${args.channel}`;
    this.logCliEvent(flags, "publish", eventType, eventMessage, finalResult);

    if (!this.shouldSuppressOutput(flags)) {
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(finalResult, flags);
      } else if (total > 1) {
        this.log(
          formatSuccess(
            `${published}/${total} messages published to channel: ${formatResource(args.channel as string)}${errors > 0 ? ` (${chalk.red(errors)} errors)` : ""}.`,
          ),
        );
      } else if (errors === 0) {
        const serial =
          results[0]?.serial == null ? undefined : String(results[0].serial);
        this.log(
          formatSuccess(
            `Message published to channel: ${formatResource(args.channel as string)}.`,
          ),
        );
        if (serial) {
          this.log(`  Serial: ${formatResource(serial)}`);
        }
      } else {
        // Error message already logged by publishMessages loop or prepareMessage
      }
    }
  }

  private async publishMessages(
    args: Record<string, unknown>,
    flags: Record<string, unknown>,
    publisher: (msg: Ably.Message) => Promise<Ably.PublishResult | void>,
  ): Promise<void> {
    // Validate count and delay
    const count = Math.max(1, flags.count as number);
    let delay = flags.delay as number;

    this.logCliEvent(
      flags,
      "publish",
      "startingPublish",
      `Publishing ${count} messages with ${delay}ms delay...`,
      { count, delay },
    );
    if (count > 1 && !this.shouldOutputJson(flags)) {
      this.log(
        formatProgress(`Publishing ${count} messages with ${delay}ms delay`),
      );
    }

    let publishedCount = 0;
    let errorCount = 0;
    const results: {
      error?: string;
      index: number;
      message?: Ably.Message;
      success: boolean;
    }[] = [];

    // Setup progress indicator
    this.setupProgressIndicator(
      flags,
      count,
      () => publishedCount,
      () => errorCount,
    );

    for (let i = 0; i < count; i++) {
      if (delay > 0 && i > 0) {
        // Wait for the specified delay before publishing the next message
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      const messageIndex = i + 1;
      const message = prepareMessageFromInput(args.message as string, flags, {
        interpolationIndex: messageIndex,
      });

      try {
        const publishResult = await publisher(message);
        publishedCount++;
        const serial = publishResult?.serials?.[0] ?? undefined;
        const result = {
          index: messageIndex,
          message,
          success: true,
          ...(serial === undefined ? {} : { serial }),
        };
        results.push(result);
        this.logCliEvent(
          flags,
          "publish",
          "messagePublished",
          `Message ${messageIndex} published to channel ${args.channel}`,
          {
            index: messageIndex,
            message,
            channel: args.channel,
            ...(serial === undefined ? {} : { serial }),
          },
        );
        if (
          !this.shouldSuppressOutput(flags) &&
          !this.shouldOutputJson(flags) &&
          count > 1 // Only show individual success messages when publishing multiple messages
        ) {
          this.log(
            formatSuccess(
              `Message ${messageIndex} published to channel: ${formatResource(args.channel as string)}.`,
            ),
          );
          if (serial) {
            this.log(`  Serial: ${formatResource(serial)}`);
          }
        }
      } catch (error) {
        errorCount++;
        const errorMsg = errorMessage(error);
        const result = { error: errorMsg, index: messageIndex, success: false };
        results.push(result);
        this.logCliEvent(
          flags,
          "publish",
          "publishError",
          `Error publishing message ${messageIndex}: ${errorMsg}`,
          { error: errorMsg, index: messageIndex },
        );
        if (
          !this.shouldSuppressOutput(flags) &&
          !this.shouldOutputJson(flags)
        ) {
          this.log(
            `${chalk.red("✗")} Error publishing message ${messageIndex}: ${errorMsg}`,
          );
        }
      }
    }

    this.clearProgressIndicator();
    this.logFinalSummary(
      flags,
      count,
      publishedCount,
      errorCount,
      results,
      args,
    );
  }

  private async publishTokenStream(
    args: Record<string, unknown>,
    flags: Record<string, unknown>,
  ): Promise<void> {
    try {
      const client = await this.createAblyRealtimeClient(flags as BaseFlags);
      if (!client) {
        this.fail(
          "Failed to create Ably client. Please check your API key and try again.",
          flags as BaseFlags,
          "channelPublish",
        );
      }

      this.setupConnectionStateLogging(client, flags as BaseFlags, {
        includeUserFriendlyMessages: true,
      });

      const channel = client.channels.get(args.channel as string);

      this.setupChannelStateLogging(channel, flags as BaseFlags, {
        includeUserFriendlyMessages: true,
      });

      // Get the text to stream
      const message = prepareMessageFromInput(
        args.message as string,
        flags,
        {},
      );
      const rawData = message.data ?? args.message;
      if (typeof rawData === "object" && rawData !== null) {
        this.fail(
          "Token streaming requires text data. JSON objects cannot be streamed as tokens.",
          flags as BaseFlags,
          "channelPublish",
        );
      }
      const text = String(rawData);
      const tokenSize = flags["token-size"] as number;
      const tokens = chunkText(text, tokenSize);

      if (tokens.length === 0) {
        this.fail("No text to stream", flags as BaseFlags, "channelPublish");
      }

      const streamDuration = flags["stream-duration"] as number;

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Streaming ${tokens.length} tokens to channel ${formatResource(args.channel as string)} over ${streamDuration}s`,
          ),
        );
      }

      // Publish initial message
      const firstToken = tokens[0];
      const publishResult = await channel.publish({
        data: firstToken,
        ...(message.name ? { name: message.name } : {}),
      } as Ably.Message);
      const serial = publishResult?.serials?.[0];

      if (!serial) {
        this.fail(
          "Publish did not return a serial — streaming appends require a serial",
          flags as BaseFlags,
          "channelPublish",
        );
      }

      this.logCliEvent(
        flags,
        "publish",
        "streamInitialPublished",
        `Initial token published to channel ${args.channel}`,
        { serial, token: firstToken, tokenIndex: 0 },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonEvent(
          {
            message: {
              action: "message.create",
              serial,
              channel: args.channel,
              data: firstToken,
              tokenIndex: 0,
              totalTokens: tokens.length,
            },
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Initial token published (serial: ${formatResource(serial)}).`,
          ),
        );
      }

      // Stream remaining tokens as appends
      if (tokens.length > 1) {
        const remainingTokens = tokens.slice(1);
        const delay = (streamDuration * 1000) / remainingTokens.length;

        for (let i = 0; i < remainingTokens.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, delay));

          const token = remainingTokens[i];
          try {
            // Cast needed: SDK appendMessage() expects full Message but only reads serial/data fields
            await channel.appendMessage({
              serial,
              data: token,
            } as Ably.Message);

            this.logCliEvent(
              flags,
              "publish",
              "streamAppendPublished",
              `Append token ${i + 1} published to channel ${args.channel}`,
              { serial, token, tokenIndex: i + 1 },
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(
                {
                  message: {
                    action: "message.append",
                    serial,
                    channel: args.channel,
                    data: token,
                    tokenIndex: i + 1,
                    totalTokens: tokens.length,
                  },
                },
                flags,
              );
            }
          } catch (appendError) {
            this.fail(appendError, flags as BaseFlags, "channelPublish");
          }
        }
      }

      // Final summary
      const summaryData = {
        stream: {
          serial,
          channel: args.channel,
          totalTokens: tokens.length,
          streamDuration,
        },
      };

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(summaryData, flags);
      } else {
        this.log(
          formatSuccess(
            `Streamed ${tokens.length} tokens to channel ${formatResource(args.channel as string)} (serial: ${formatResource(serial)}).`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "channelPublish");
    }
  }

  private async publishWithRealtime(
    args: Record<string, unknown>,
    flags: Record<string, unknown>,
  ): Promise<void> {
    try {
      const client = await this.createAblyRealtimeClient(flags as BaseFlags);
      if (!client) {
        this.fail(
          "Failed to create Ably client. Please check your API key and try again.",
          flags as BaseFlags,
          "channelPublish",
        );
      }

      this.setupConnectionStateLogging(client, flags as BaseFlags, {
        includeUserFriendlyMessages: true,
      });

      this.logCliEvent(
        flags,
        "publish",
        "transportSelected",
        "Using Realtime transport",
      );
      const channel = client.channels.get(args.channel as string);

      this.setupChannelStateLogging(channel, flags as BaseFlags, {
        includeUserFriendlyMessages: true,
      });

      await this.publishMessages(args, flags, async (msg) => {
        return channel.publish(msg);
      });
    } catch (error) {
      this.fail(error, flags as BaseFlags, "channelPublish");
    }
    // Client cleanup is handled by command finally() method
  }

  private async publishWithRest(
    args: Record<string, unknown>,
    flags: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Create REST client
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) {
        return;
      }
      const channel = rest.channels.get(args.channel as string);

      this.logCliEvent(
        flags,
        "publish",
        "transportSelected",
        "Using REST transport",
      );

      await this.publishMessages(args, flags, async (msg) => {
        return channel.publish(msg);
      });
    } catch (error) {
      this.fail(error, flags as BaseFlags, "channelPublish");
    }
    // No finally block needed here as REST client doesn't maintain a connection
  }

  private setupProgressIndicator(
    flags: Record<string, unknown>,
    total: number,
    getPublishedCount: () => number,
    getErrorCount: () => number,
  ): void {
    if (total <= 1) return; // No progress for single message
    if (this.progressIntervalId) clearInterval(this.progressIntervalId);

    this.progressIntervalId = this.shouldOutputJson(flags)
      ? setInterval(() => {
          this.logCliEvent(
            flags,
            "publish",
            "progress",
            "Publishing messages",
            {
              errors: getErrorCount(),
              published: getPublishedCount(),
              total,
            },
          );
        }, 2000)
      : setInterval(() => {
          this.log(
            `Progress: ${getPublishedCount()}/${total} messages published (${getErrorCount()} errors)`,
          );
        }, 1000);
  }
}
