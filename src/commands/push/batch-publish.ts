import { Args, Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { AblyBaseCommand } from "../../base-command.js";
import { CommandError } from "../../errors/command-error.js";
import { productApiFlags } from "../../flags.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";
import { BaseFlags } from "../../types/cli.js";
import {
  formatCountLabel,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../utils/output.js";

interface BatchResponseItem {
  channel: string;
  messageId?: string;
  error?: {
    message: string;
    code: number;
  };
  [key: string]: unknown;
}

export default class PushBatchPublish extends AblyBaseCommand {
  static override description =
    "Publish push notifications to multiple recipients in a batch";

  static override examples = [
    {
      description: "Send a notification to a specific device",
      command:
        '<%= config.bin %> <%= command.id %> \'[{"recipient":{"deviceId":"device-123"},"payload":{"notification":{"title":"Hello","body":"World"}}}]\'',
    },
    {
      description: "Send a notification to a client ID",
      command:
        '<%= config.bin %> <%= command.id %> \'[{"recipient":{"clientId":"user-456"},"payload":{"notification":{"title":"Hello","body":"World"}}}]\'',
    },
    {
      description: "Send a data-only push (no notification) to a device",
      command:
        '<%= config.bin %> <%= command.id %> \'[{"recipient":{"deviceId":"device-123"},"payload":{"data":{"orderId":"123","action":"update"}}}]\'',
    },
    {
      description: "Publish to all devices subscribed to a channel",
      command:
        '<%= config.bin %> <%= command.id %> \'[{"channels":["my-channel"],"payload":{"notification":{"title":"Hello","body":"World"}}}]\' --force',
    },
    {
      description: "Publish to multiple channels in one batch item",
      command:
        '<%= config.bin %> <%= command.id %> \'[{"channels":["channel-1","channel-2"],"payload":{"notification":{"title":"Alert","body":"Message"}}}]\' --force',
    },
    {
      description: "Mixed batch: device recipient and channel in one request",
      command:
        '<%= config.bin %> <%= command.id %> \'[{"recipient":{"deviceId":"device-123"},"payload":{"notification":{"title":"Hello","body":"World"}}},{"channels":["my-channel"],"payload":{"notification":{"title":"Hello","body":"World"}}}]\' --force',
    },
    {
      description: "Load batch payload from a JSON file",
      command:
        "<%= config.bin %> <%= command.id %> ./notifications.json --force",
    },
    {
      description: "Read batch payload from stdin",
      command: "$ cat batch.json | <%= config.bin %> <%= command.id %> --force",
    },
    {
      description: "Output results as JSON",
      command:
        "<%= config.bin %> <%= command.id %> ./notifications.json --json --force",
    },
  ];

  static override args = {
    payload: Args.string({
      description:
        'Batch payload as JSON array, filepath, or - for stdin. Each item must have either a "recipient" or "channels" key. Items with "channels" are routed via channel batch publish with the payload wrapped in extras.push',
    }),
  };

  static override flags = {
    ...productApiFlags,
    force: Flags.boolean({
      char: "f",
      description:
        "Skip confirmation prompt when publishing to channels (confirmation is also skipped in --json mode)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PushBatchPublish);

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      let jsonString: string;
      const payloadArg = args.payload;

      if (!payloadArg) {
        if (process.stdin.isTTY) {
          this.fail(
            'Missing PAYLOAD. Provide a JSON array, a file path, or "-" to read from stdin.',
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }
        jsonString = await this.readStdin();
      } else if (payloadArg === "-") {
        jsonString = await this.readStdin();
      } else if (payloadArg.startsWith("@")) {
        const filePath = path.resolve(payloadArg.slice(1));
        if (!fs.existsSync(filePath)) {
          this.fail(
            `File not found: ${filePath}`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }
        jsonString = fs.readFileSync(filePath, "utf8");
      } else if (
        payloadArg.startsWith("/") ||
        payloadArg.startsWith("./") ||
        payloadArg.startsWith("../")
      ) {
        const filePath = path.resolve(payloadArg);
        if (!fs.existsSync(filePath)) {
          this.fail(
            `File not found: ${filePath}`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }
        jsonString = fs.readFileSync(filePath, "utf8");
      } else if (fs.existsSync(path.resolve(payloadArg))) {
        jsonString = fs.readFileSync(path.resolve(payloadArg), "utf8");
      } else {
        jsonString = payloadArg;
      }

      let batchPayload: unknown[];
      try {
        batchPayload = JSON.parse(jsonString) as unknown[];
      } catch {
        this.fail(
          "Payload must be a valid JSON array",
          flags as BaseFlags,
          "pushBatchPublish",
        );
      }

      if (!Array.isArray(batchPayload)) {
        this.fail(
          "Payload must be a JSON array",
          flags as BaseFlags,
          "pushBatchPublish",
        );
      }

      if (batchPayload.length > 10000) {
        this.fail(
          "Batch payload cannot exceed 10,000 items",
          flags as BaseFlags,
          "pushBatchPublish",
        );
      }

      // Split items by routing: recipient → /push/batch/publish, channels → /messages
      const recipientItems: Array<{
        entry: Record<string, unknown>;
        originalIndex: number;
      }> = [];
      const channelItems: Array<{
        entry: Record<string, unknown>;
        originalIndex: number;
      }> = [];

      for (const [index, item] of batchPayload.entries()) {
        const entry = item as Record<string, unknown>;
        const itemPayload = entry.payload as
          | Record<string, unknown>
          | undefined;

        if (!itemPayload?.notification && !itemPayload?.data) {
          this.fail(
            `Item at index ${index} must have a "payload.notification" or "payload.data" field`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }

        if (entry.recipient) {
          recipientItems.push({ entry, originalIndex: index });
        } else if (entry.channels) {
          const ch = entry.channels;
          const valid =
            (typeof ch === "string" && ch.trim().length > 0) ||
            (Array.isArray(ch) &&
              ch.length > 0 &&
              ch.every((c) => typeof c === "string" && c.trim().length > 0));
          if (valid) {
            channelItems.push({ entry, originalIndex: index });
          } else {
            this.fail(
              `Item at index ${index} has an invalid "channels" field; expected a non-empty string or array of non-empty strings`,
              flags as BaseFlags,
              "pushBatchPublish",
            );
          }
        } else {
          this.fail(
            `Item at index ${index} must have a "recipient" or "channels" field`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }
      }

      let totalSucceeded = 0;
      let totalFailed = 0;
      const failedDetails: string[] = [];
      const failedItems: Record<string, unknown>[] = [];

      // Recipient-based push: route to /push/batch/publish
      if (recipientItems.length > 0) {
        if (!this.shouldOutputJson(flags) && !flags.force) {
          const confirmed = await promptForConfirmation(
            `This will send push notifications to ${formatCountLabel(recipientItems.length, "recipient")}. Continue?`,
          );
          if (!confirmed) {
            this.log("Publish cancelled.");
            return;
          }
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Publishing batch of ${formatCountLabel(recipientItems.length, "notification")} to recipients`,
            ),
          );
        }

        const response = await rest.request(
          "post",
          "/push/batch/publish",
          2,
          null,
          recipientItems.map(({ entry }) => entry),
        );

        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.fail(
            CommandError.fromHttpResponse(
              response,
              "Batch push publish failed",
            ),
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }

        const items = (response.items ?? []) as Record<string, unknown>[];
        const failedWithIndex = items
          .map((item, i) => ({
            item,
            originalIndex: recipientItems[i]?.originalIndex ?? i,
          }))
          .filter(
            ({ item }) =>
              item.error || (item.statusCode && item.statusCode !== 200),
          );
        totalSucceeded +=
          items.length > 0
            ? items.length - failedWithIndex.length
            : recipientItems.length;
        totalFailed += failedWithIndex.length;

        for (const { item, originalIndex } of failedWithIndex) {
          const error = item.error as Record<string, unknown> | undefined;
          const message = error?.message ?? "Unknown error";
          const code = error?.code ? ` (code: ${error.code})` : "";
          failedDetails.push(`  Failed: ${message}${code}`);
          failedItems.push({ ...item, originalIndex });
        }
      }

      // Channel-based push: route to /messages with extras.push
      if (channelItems.length > 0) {
        const channelBatchSpecs = channelItems.map(({ entry }) => ({
          channels: entry.channels,
          messages: {
            extras: { push: entry.payload },
          },
        }));

        if (!this.shouldOutputJson(flags) && !flags.force) {
          const allChannels = channelItems.flatMap(({ entry }) =>
            Array.isArray(entry.channels)
              ? (entry.channels as string[])
              : [entry.channels as string],
          );
          const uniqueChannels = [...new Set(allChannels)];
          const channelList = uniqueChannels
            .map((c) => formatResource(c))
            .join(", ");
          const confirmed = await promptForConfirmation(
            `This will send a push notification to all devices subscribed to ${formatCountLabel(uniqueChannels.length, "channel")} (${channelList}). Continue?`,
          );
          if (!confirmed) {
            this.log("Publish cancelled.");
            return;
          }
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Publishing batch of ${formatCountLabel(channelItems.length, "notification")} to channels`,
            ),
          );
        }

        const response = await rest.request(
          "post",
          "/messages",
          2,
          null,
          channelBatchSpecs,
        );

        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.fail(
            CommandError.fromHttpResponse(
              response,
              "Batch channel publish failed",
            ),
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }

        const responseItems = (response.items ?? []) as BatchResponseItem[];
        const failedWithIndex = responseItems
          .map((item, i) => ({
            item,
            originalIndex: channelItems[i]?.originalIndex ?? i,
          }))
          .filter(({ item }) => item.error);
        totalSucceeded +=
          responseItems.length > 0
            ? responseItems.length - failedWithIndex.length
            : channelItems.length;
        totalFailed += failedWithIndex.length;

        for (const { item, originalIndex } of failedWithIndex) {
          failedDetails.push(
            `  Failed on ${formatResource(item.channel)}: ${item.error?.message} (code: ${item.error?.code})`,
          );
          failedItems.push({ ...item, originalIndex });
        }
      }

      const total = totalSucceeded + totalFailed;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            publish: {
              published: true,
              total,
              succeeded: totalSucceeded,
              failed: totalFailed,
              ...(totalFailed > 0 ? { failedItems } : {}),
            },
          },
          flags,
        );
      } else {
        if (totalFailed > 0) {
          this.log(
            formatSuccess(
              `Batch published: ${totalSucceeded} succeeded, ${totalFailed} failed out of ${formatCountLabel(total, "notification")}.`,
            ),
          );
          for (const detail of failedDetails) {
            this.logToStderr(detail);
          }
        } else {
          this.log(
            formatSuccess(
              `Batch of ${formatCountLabel(total, "notification")} published.`,
            ),
          );
        }
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushBatchPublish");
    }
  }

  private async readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => {
        resolve(data);
      });
      process.stdin.on("error", reject);
    });
  }
}
