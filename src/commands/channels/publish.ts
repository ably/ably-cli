import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../flags.js";
import { BaseFlags } from "../../types/cli.js";
import { errorMessage, extractErrorInfo } from "../../utils/errors.js";
import { prepareMessageFromInput } from "../../utils/message.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../utils/output.js";

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
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels publish my-channel \'{"data":"Simple message"}\'',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    count: Flags.integer({
      char: "c",
      default: 1,
      description: "Number of messages to publish",
      min: 1,
    }),
    delay: Flags.integer({
      char: "d",
      default: 40,
      description: "Delay between messages in milliseconds (max 25 msgs/sec)",
    }),
    encoding: Flags.string({
      char: "e",
      description: "The encoding for the message",
    }),
    name: Flags.string({
      char: "n",
      description: "The event name (if not specified in the message JSON)",
    }),
    transport: Flags.string({
      description: "Transport method to use for publishing (rest or realtime)",
      options: ["rest", "realtime"],
    }),
  };

  private progressIntervalId: NodeJS.Timeout | null = null;
  private realtime: Ably.Realtime | null = null;

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
      publish: {
        errors,
        published,
        results,
        allSucceeded: errors === 0 && published === total,
        total,
        channel: args.channel,
      },
    };
    const eventType =
      total > 1 ? "multiPublishComplete" : "singlePublishComplete";
    const eventMessage =
      total > 1
        ? `Published ${total} messages to channel ${String(args.channel)}`
        : `Published message to channel ${String(args.channel)}`;
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
          results[0]?.serial == null
            ? undefined
            : typeof results[0].serial === "string"
              ? results[0].serial
              : JSON.stringify(results[0].serial);
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
      error?: {
        message: string;
        code?: number;
        statusCode?: number;
        href?: string;
      };
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
        // publishResult is void | PublishResult — void when channels don't support serials
        const serial = (publishResult as { serials?: string[] } | undefined)
          ?.serials?.[0];
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
          `Message ${messageIndex} published to channel ${String(args.channel)}`,
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
        const result = {
          error: extractErrorInfo(error),
          index: messageIndex,
          success: false,
        };
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

  private async publishWithRealtime(
    args: Record<string, unknown>,
    flags: Record<string, unknown>,
  ): Promise<void> {
    try {
      this.realtime = await this.createAblyRealtimeClient(flags as BaseFlags);
      if (!this.realtime) {
        this.fail(
          "Failed to create Ably client. Please check your API key and try again.",
          flags as BaseFlags,
          "channelPublish",
        );
      }

      const client = this.realtime;

      client.connection.on((stateChange: Ably.ConnectionStateChange) => {
        this.logCliEvent(
          flags,
          "connection",
          stateChange.current,
          `Connection state changed to ${stateChange.current}`,
          { reason: stateChange.reason },
        );
      });

      this.logCliEvent(
        flags,
        "publish",
        "transportSelected",
        "Using Realtime transport",
      );
      const channel = client.channels.get(args.channel as string);

      channel.on((stateChange: Ably.ChannelStateChange) => {
        this.logCliEvent(
          flags,
          "channel",
          stateChange.current,
          `Channel '${String(args.channel)}' state changed to ${stateChange.current}`,
          { reason: stateChange.reason },
        );
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
