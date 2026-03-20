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
  formatWarning,
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
    '$ ably channels publish my-channel "The quick brown fox" --token-streaming --name ai-response',
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels publish my-channel \'{"data":"Simple message"}\'',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    "token-size": Flags.integer({
      default: 4,
      dependsOn: ["token-streaming"],
      description:
        "Approximate characters per streamed chunk (simulates token-sized fragments)",
      min: 1,
    }),
    count: Flags.integer({
      char: "c",
      default: 1,
      description: "Number of messages to publish (default: 1)",
      min: 1,
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
  // Accumulated by buildTokenStreamPublisher after each successful stream, read by logFinalSummary for JSON output
  private streamResults: {
    serial: string;
    totalTokens: number;
    streamDuration: number;
  }[] = [];

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }

    // Client cleanup is handled by base class
    return super.finally(err);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPublish);

    // Token streaming always uses realtime (needs appendMessage)
    // Use Realtime transport by default when publishing multiple messages to ensure ordering
    // If transport is not explicitly set and count > 1, use realtime
    // If transport is explicitly set, respect that choice
    const shouldUseRealtime =
      flags["token-streaming"] ||
      flags.transport === "realtime" ||
      (!flags.transport && flags.count > 1);

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

    // Snapshot and reset accumulated stream results
    const streams = this.streamResults;
    this.streamResults = [];

    if (!this.shouldSuppressOutput(flags)) {
      if (this.shouldOutputJson(flags)) {
        const jsonData =
          streams.length > 0
            ? {
                channel: args.channel,
                tokenStreams: streams,
                published,
                total,
                errors,
                allSucceeded: errors === 0 && published === total,
              }
            : { publish: finalResult };
        this.logJsonResult(jsonData, flags);
      } else if (total > 1 && streams.length > 0) {
        this.log(
          formatSuccess(
            `${published}/${total} messages streamed to channel: ${formatResource(args.channel as string)}${errors > 0 ? ` (${chalk.red(errors)} errors)` : ""}.`,
          ),
        );
      } else if (total > 1) {
        this.log(
          formatSuccess(
            `${published}/${total} messages published to channel: ${formatResource(args.channel as string)}${errors > 0 ? ` (${chalk.red(errors)} errors)` : ""}.`,
          ),
        );
      } else if (errors === 0 && streams.length === 0) {
        // Skip for token streaming — the publisher already logged its own summary
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
        // Error message already logged by publishMessages loop, or token streaming logged its own summary
      }
    }
  }

  private async publishMessages(
    args: Record<string, unknown>,
    flags: Record<string, unknown>,
    publisher: (msg: Ably.Message) => Promise<Ably.PublishResult | void>,
  ): Promise<void> {
    // Validate count and delay
    const count = flags.count as number;
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

    // Setup progress indicator (skip for token streaming — the publisher logs its own progress)
    if (!flags["token-streaming"]) {
      this.setupProgressIndicator(
        flags,
        count,
        () => publishedCount,
        () => errorCount,
      );
    }

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
          !flags["token-streaming"] && // Stream publisher logs its own per-stream summary
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
        // Let oclif exit errors (from this.fail()) propagate — they carry
        // structured error data (Ably codes, hints) that must not be swallowed.
        if (error instanceof Error && "oclif" in error) throw error;

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

  private logTokenEvent(
    flags: Record<string, unknown>,
    action: "message.create" | "message.append",
    serial: string,
    channel: string,
    data: string,
    tokenIndex: number,
    totalTokens: number,
    name?: string,
    clientId?: string,
    connectionId?: string,
  ): void {
    const isCreate = action === "message.create";
    this.logCliEvent(
      flags,
      "publish",
      isCreate ? "streamInitialPublished" : "streamAppendPublished",
      `${isCreate ? "Initial" : "Append"} token ${isCreate ? "" : `${tokenIndex} `}published to channel ${channel}`,
      { serial, token: data, tokenIndex },
    );

    if (this.shouldOutputJson(flags)) {
      this.logJsonEvent(
        {
          message: {
            action,
            serial,
            channel,
            data,
            tokenIndex,
            totalTokens,
            timestamp: new Date().toISOString(),
            ...(name ? { name } : {}),
            ...(clientId ? { clientId } : {}),
            ...(connectionId ? { connectionId } : {}),
          },
        },
        flags,
      );
    } else if (isCreate) {
      this.log(
        formatSuccess(
          `Initial token published (serial: ${formatResource(serial)}).`,
        ),
      );
    }
  }

  private buildTokenStreamPublisher(
    channel: Ably.RealtimeChannel,
    flags: Record<string, unknown>,
    args: Record<string, unknown>,
    clientId?: string,
    connectionId?: string,
  ): (msg: Ably.Message) => Promise<Ably.PublishResult | void> {
    const tokenSize = flags["token-size"] as number;
    const streamDuration = flags["stream-duration"] as number;
    const count = flags.count as number;
    let streamIndex = 0;
    const channelName = args.channel as string;

    return async (msg: Ably.Message) => {
      streamIndex++;

      // Validate data is text-like
      const rawData = msg.data;
      if (rawData === undefined || rawData === null) {
        this.fail("No text to stream", flags as BaseFlags, "channelPublish");
      }
      if (typeof rawData === "object") {
        this.fail(
          "Token streaming requires text data. JSON objects cannot be streamed as tokens.",
          flags as BaseFlags,
          "channelPublish",
        );
      }
      const tokens = chunkText(String(rawData), tokenSize);

      if (tokens.length === 1 && !this.shouldOutputJson(flags)) {
        this.logToStderr(
          formatWarning(
            "Text fits in a single token — no appends will be streamed. Use a smaller --token-size to split the text.",
          ),
        );
      }

      if (tokens.length === 0) {
        this.fail("No text to stream", flags as BaseFlags, "channelPublish");
      }

      if (!this.shouldOutputJson(flags)) {
        const tokenWord = tokens.length === 1 ? "token" : "tokens";
        const streamLabel = count > 1 ? ` [${streamIndex}/${count}]` : "";
        this.log(
          formatProgress(
            `Streaming ${tokens.length} ${tokenWord} to channel ${formatResource(channelName)} over ${streamDuration}s${streamLabel}`,
          ),
        );
      }

      // Publish initial token
      const publishResult = await channel.publish({
        data: tokens[0],
        ...(msg.name ? { name: msg.name } : {}),
        ...(msg.encoding ? { encoding: msg.encoding } : {}),
        ...(msg.extras ? { extras: msg.extras } : {}),
      } as Ably.Message);
      const serial = publishResult?.serials?.[0];

      if (!serial) {
        this.fail(
          "Publish did not return a serial — streaming appends require a serial",
          flags as BaseFlags,
          "channelPublish",
        );
      }

      this.logTokenEvent(
        flags,
        "message.create",
        serial,
        channelName,
        tokens[0],
        0,
        tokens.length,
        msg.name,
        clientId,
        connectionId,
      );

      // Stream remaining tokens as appends, paced by --stream-duration.
      // Ably guarantees ordering on a realtime connection, so appends are
      // fire-and-forget (not awaited individually) per the Ably docs. We
      // collect the promises and use Promise.allSettled after the loop to
      // detect any failures and recover with updateMessage if needed.
      if (tokens.length > 1) {
        const tokenDelay = (streamDuration * 1000) / (tokens.length - 1);

        const appendPromises: Promise<void>[] = [];
        for (let i = 1; i < tokens.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, tokenDelay));

          const promise = channel
            .appendMessage({
              serial,
              data: tokens[i],
              ...(msg.encoding ? { encoding: msg.encoding } : {}),
              ...(msg.extras ? { extras: msg.extras } : {}),
            } as Ably.Message)
            .then(() => {
              this.logTokenEvent(
                flags,
                "message.append",
                serial,
                channelName,
                tokens[i],
                i,
                tokens.length,
                msg.name,
                clientId,
                connectionId,
              );
            });
          // No-op catch prevents unhandled rejection warnings during the
          // loop's sleep. The original promise (before .catch) is what we
          // push to appendPromises, so allSettled still sees rejections.
          promise.catch(() => {});
          appendPromises.push(promise);
        }

        const results = await Promise.allSettled(appendPromises);
        const failedCount = results.filter(
          (r) => r.status === "rejected",
        ).length;
        if (failedCount > 0) {
          try {
            await channel.updateMessage({
              serial,
              data: String(rawData),
              ...(msg.encoding ? { encoding: msg.encoding } : {}),
              ...(msg.extras ? { extras: msg.extras } : {}),
            } as Ably.Message);

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(
                {
                  message: {
                    action: "message.recovery",
                    serial,
                    channel: channelName,
                    data: String(rawData),
                    failedAppends: failedCount,
                    totalTokens: tokens.length,
                    timestamp: new Date().toISOString(),
                    ...(msg.name ? { name: msg.name } : {}),
                    ...(clientId ? { clientId } : {}),
                    ...(connectionId ? { connectionId } : {}),
                  },
                },
                flags,
              );
            } else {
              this.logToStderr(
                formatWarning(
                  `${failedCount} append${failedCount === 1 ? "" : "s"} failed. Recovered by publishing full message via updateMessage.`,
                ),
              );
            }
          } catch (updateError) {
            this.fail(updateError, flags as BaseFlags, "channelPublish");
          }
        }
      }

      // Accumulate stream info for the final JSON result envelope
      this.streamResults.push({
        serial,
        totalTokens: tokens.length,
        streamDuration,
      });

      if (!this.shouldOutputJson(flags)) {
        const tokenWord = tokens.length === 1 ? "token" : "tokens";
        this.log(
          formatSuccess(
            `Streamed ${tokens.length} ${tokenWord} to channel ${formatResource(channelName)} (serial: ${formatResource(serial)}).`,
          ),
        );
      }

      return publishResult;
    };
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

      const publisher = flags["token-streaming"]
        ? this.buildTokenStreamPublisher(
            channel,
            flags,
            args,
            client.auth.clientId,
            client.connection.id,
          )
        : async (msg: Ably.Message) => channel.publish(msg);

      await this.publishMessages(args, flags, publisher);
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
