import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags } from "../../flags.js";
import { BaseFlags } from "../../types/cli.js";
import {
  formatCountLabel,
  formatProgress,
  formatSuccess,
} from "../../utils/output.js";

export default class PushBatchPublish extends AblyBaseCommand {
  static override description =
    "Publish push notifications to multiple recipients in a batch";

  static override examples = [
    '<%= config.bin %> <%= command.id %> --payload \'[{"recipient":{"deviceId":"dev1"},"payload":{"notification":{"title":"Hello","body":"World"}}}]\'',
    "<%= config.bin %> <%= command.id %> --payload @batch.json",
    "cat batch.json | <%= config.bin %> <%= command.id %> --payload -",
    "<%= config.bin %> <%= command.id %> --payload @batch.json --json",
  ];

  static override flags = {
    ...productApiFlags,
    payload: Flags.string({
      description: "Batch payload as JSON array, @filepath, or - for stdin",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushBatchPublish);

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      let jsonString: string;

      if (flags.payload === "-") {
        // Read from stdin
        jsonString = await this.readStdin();
      } else if (flags.payload.startsWith("@")) {
        const filePath = path.resolve(flags.payload.slice(1));
        if (!fs.existsSync(filePath)) {
          this.fail(
            `File not found: ${filePath}`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }
        jsonString = fs.readFileSync(filePath, "utf8");
      } else if (
        flags.payload.startsWith("/") ||
        flags.payload.startsWith("./") ||
        flags.payload.startsWith("../")
      ) {
        const filePath = path.resolve(flags.payload);
        if (!fs.existsSync(filePath)) {
          this.fail(
            `File not found: ${filePath}`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }
        jsonString = fs.readFileSync(filePath, "utf8");
      } else {
        jsonString = flags.payload;
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

      for (const [index, item] of batchPayload.entries()) {
        const entry = item as Record<string, unknown>;
        if (!entry.recipient) {
          this.fail(
            `Item at index ${index} is missing required "recipient" field`,
            flags as BaseFlags,
            "pushBatchPublish",
          );
        }

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
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Publishing batch of ${formatCountLabel(batchPayload.length, "notification")}`,
          ),
        );
      }

      const response = await rest.request(
        "post",
        "/push/batch/publish",
        2,
        null,
        batchPayload,
      );

      // Parse response items for success/failure counts
      const items = (response.items ?? []) as Record<string, unknown>[];
      const failed = items.filter(
        (item) => item.error || (item.statusCode && item.statusCode !== 200),
      );
      const succeeded =
        items.length > 0 ? items.length - failed.length : batchPayload.length;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            published: true,
            total: batchPayload.length,
            succeeded,
            failed: failed.length,
            ...(failed.length > 0 ? { failedItems: failed } : {}),
          },
          flags,
        );
      } else {
        if (failed.length > 0) {
          this.log(
            formatSuccess(
              `Batch published: ${succeeded} succeeded, ${failed.length} failed out of ${formatCountLabel(batchPayload.length, "notification")}.`,
            ),
          );
          for (const item of failed) {
            const error = item.error as Record<string, unknown> | undefined;
            const message = error?.message ?? "Unknown error";
            const code = error?.code ? ` (code: ${error.code})` : "";
            this.logToStderr(`  Failed: ${message}${code}`);
          }
        } else {
          this.log(
            formatSuccess(
              `Batch of ${formatCountLabel(batchPayload.length, "notification")} published.`,
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
