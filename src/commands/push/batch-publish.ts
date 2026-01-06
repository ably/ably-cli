import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../base-command.js";
import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";

interface BatchItem {
  recipient: {
    deviceId?: string;
    clientId?: string;
  };
  payload: Record<string, unknown>;
}

export default class PushBatchPublish extends AblyBaseCommand {
  static override description =
    "Publish push notifications to multiple recipients in a single request (up to 10,000 notifications)";

  static override examples = [
    // From JSON file
    "$ ably push batch-publish --payload ./batch-notifications.json",
    // From inline JSON
    '$ ably push batch-publish --payload \'[{"recipient":{"deviceId":"abc"},"payload":{"notification":{"title":"Hi"}}}]\'',
    // From stdin
    "$ cat batch.json | ably push batch-publish --payload -",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    payload: Flags.string({
      description:
        "Batch payload as JSON array, file path, or - for stdin (required)",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushBatchPublish);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Parse batch payload
      const batchItems = await this.parseBatchPayload(flags.payload);

      // Validate batch items
      this.validateBatchItems(batchItems);

      if (batchItems.length > 10000) {
        this.error("Batch size exceeds maximum of 10,000 notifications");
      }

      if (batchItems.length === 0) {
        this.error("Batch payload is empty");
      }

      // Publish batch using REST API directly
      // The SDK's push.admin.publish doesn't have a batch method,
      // so we use the REST API directly
      const response = await rest.request(
        "POST",
        "/push/batch/publish",
        2, // API version
        {},
        batchItems,
        {},
      );

      // Process response
      const results = response.items || [];
      const successful = results.filter(
        (r: Record<string, unknown>) => !r.error,
      ).length;
      const failed = results.filter(
        (r: Record<string, unknown>) => r.error,
      ).length;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              total: batchItems.length,
              successful,
              failed,
              results: results.map((r: Record<string, unknown>, i: number) => ({
                index: i,
                success: !r.error,
                error: r.error,
              })),
              success: failed === 0,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(chalk.bold("Batch Push Results\n"));
        this.log(`${chalk.dim("Total:")}      ${batchItems.length}`);
        this.log(
          `${chalk.dim("Successful:")} ${chalk.green(successful.toString())}`,
        );

        if (failed > 0) {
          this.log(
            `${chalk.dim("Failed:")}     ${chalk.red(failed.toString())}`,
          );
          this.log("");
          this.log(chalk.yellow("Failed Notifications:"));

          results.forEach((r: Record<string, unknown>, i: number) => {
            if (r.error) {
              const error = r.error as Record<string, unknown>;
              const recipient = batchItems[i]?.recipient;
              const recipientStr = recipient?.deviceId
                ? `deviceId=${recipient.deviceId}`
                : recipient?.clientId
                  ? `clientId=${recipient.clientId}`
                  : "unknown";

              this.log(`  - Recipient: ${recipientStr}`);
              this.log(
                `    Error: ${error.message || "Unknown error"} (code: ${error.code || "unknown"})`,
              );
            }
          });
        } else {
          this.log("");
          this.log(chalk.green("All notifications sent successfully!"));
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: number }).code;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error: errorMessage,
              code: errorCode,
              success: false,
            },
            flags,
          ),
        );
      } else {
        this.error(`Error publishing batch notifications: ${errorMessage}`);
      }
    }
  }

  private async parseBatchPayload(payload: string): Promise<BatchItem[]> {
    let jsonString: string;

    if (payload === "-") {
      // Read from stdin
      jsonString = await this.readStdin();
    } else if (
      !payload.trim().startsWith("[") &&
      !payload.trim().startsWith("{")
    ) {
      // It's a file path
      const filePath = path.resolve(payload);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      jsonString = fs.readFileSync(filePath, "utf8");
    } else {
      jsonString = payload;
    }

    try {
      const parsed = JSON.parse(jsonString);

      // Ensure it's an array
      if (!Array.isArray(parsed)) {
        throw new TypeError("Batch payload must be a JSON array");
      }

      return parsed as BatchItem[];
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new TypeError("Invalid JSON format in batch payload");
      }

      throw error;
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

      process.stdin.on("error", (err) => {
        reject(err);
      });

      // Set a timeout for stdin reading
      setTimeout(() => {
        if (data === "") {
          reject(new Error("No data received from stdin"));
        }
      }, 5000);
    });
  }

  private validateBatchItems(items: BatchItem[]): void {
    items.forEach((item, index) => {
      if (!item.recipient) {
        throw new Error(`Item ${index}: missing 'recipient' field`);
      }

      if (!item.recipient.deviceId && !item.recipient.clientId) {
        throw new Error(
          `Item ${index}: recipient must have either 'deviceId' or 'clientId'`,
        );
      }

      if (!item.payload) {
        throw new Error(`Item ${index}: missing 'payload' field`);
      }
    });
  }
}
