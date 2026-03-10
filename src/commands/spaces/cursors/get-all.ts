import { type CursorUpdate } from "@ably/spaces";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import isTestMode from "../../../utils/test-mode.js";
import {
  formatClientId,
  formatCountLabel,
  formatHeading,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";

export default class SpacesCursorsGetAll extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get cursors from",
      required: true,
    }),
  };

  static override description = "Get all current cursors in a space";

  static override examples = [
    "$ ably spaces cursors get-all my-space",
    "$ ably spaces cursors get-all my-space --json",
    "$ ably spaces cursors get-all my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCursorsGetAll);
    const { space: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      // Get the space
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(`Connecting to space: ${formatResource(spaceName)}`),
        );
      }

      // Enter the space
      await this.space!.enter();

      // Wait for space to be properly entered before fetching cursors
      await new Promise<void>((resolve, reject) => {
        // Set a reasonable timeout to avoid hanging indefinitely
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for space connection"));
        }, 5000);

        const checkSpaceStatus = () => {
          try {
            // Check realtime client state
            if (this.realtimeClient!.connection.state === "connected") {
              clearTimeout(timeout);
              if (!this.shouldOutputJson(flags)) {
                this.log(
                  formatSuccess(`Entered space: ${formatResource(spaceName)}.`),
                );
              }

              resolve();
            } else if (
              this.realtimeClient!.connection.state === "failed" ||
              this.realtimeClient!.connection.state === "closed" ||
              this.realtimeClient!.connection.state === "suspended"
            ) {
              clearTimeout(timeout);
              reject(
                new Error(
                  `Space connection failed with state: ${this.realtimeClient!.connection.state}`,
                ),
              );
            } else {
              // Still connecting, check again shortly
              setTimeout(checkSpaceStatus, 100);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        checkSpaceStatus();
      });

      // Subscribe to cursor updates to ensure we receive remote cursors
      let cursorUpdateReceived = false;
      const cursorMap = new Map<string, CursorUpdate>();

      // Show initial message
      if (!this.shouldOutputJson(flags)) {
        const waitSeconds = isTestMode() ? "0.5" : "5";
        this.log(`Collecting cursor positions for ${waitSeconds} seconds...`);
        this.log(chalk.dim("─".repeat(60)));
      }

      const cursorUpdateHandler = (cursor: CursorUpdate) => {
        cursorUpdateReceived = true;

        // Update the cursor map
        if (cursor.connectionId) {
          cursorMap.set(cursor.connectionId, cursor);

          // Show live cursor position updates
          if (
            !this.shouldOutputJson(flags) &&
            this.shouldUseTerminalUpdates()
          ) {
            const clientDisplay = cursor.clientId || "Unknown";
            const x = cursor.position.x;
            const y = cursor.position.y;

            this.log(
              `${chalk.gray("►")} ${formatClientId(clientDisplay)}: (${chalk.yellow(x)}, ${chalk.yellow(y)})`,
            );
          }
        }
      };

      try {
        await this.space!.cursors.subscribe("update", cursorUpdateHandler);
      } catch (error) {
        // If subscription fails, continue anyway
        if (!this.shouldOutputJson(flags)) {
          this.debug(`Cursor subscription error: ${error}`);
        }
      }

      // Wait for 5 seconds (or shorter in test mode)
      const waitTime = isTestMode() ? 500 : 5000;
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, waitTime);
      });

      // Unsubscribe from cursor updates
      this.space!.cursors.unsubscribe("update", cursorUpdateHandler);

      // Ensure connection is stable before calling getAll()
      if (this.realtimeClient!.connection.state !== "connected") {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timed out waiting for connection to stabilize"));
          }, 5000);

          this.realtimeClient!.connection.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });

          if (this.realtimeClient!.connection.state === "connected") {
            clearTimeout(timeout);
            resolve();
          }
        });
      }

      // Now get all cursors (including locally cached ones) and merge with live updates
      try {
        const allCursors = await this.space!.cursors.getAll();

        // Add any cached cursors that we didn't see in live updates
        for (const cursor of Object.values(allCursors)) {
          if (cursor && !cursorMap.has(cursor.connectionId)) {
            cursorMap.set(cursor.connectionId, cursor);
          }
        }
      } catch {
        // If getAll fails due to connection issues, use only the live updates we collected
        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatWarning(
              "Could not fetch all cursors, showing only live updates.",
            ),
          );
        }
      }

      const cursors = [...cursorMap.values()];

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            connectionId: this.realtimeClient!.connection.id,
            cursors: cursors.map((cursor: CursorUpdate) => ({
              clientId: cursor.clientId,
              connectionId: cursor.connectionId,
              data: cursor.data,
              position: cursor.position,
            })),
            spaceName,
            cursorUpdateReceived,
          },
          flags,
        );
      } else {
        if (!cursorUpdateReceived && cursors.length === 0) {
          this.log(chalk.dim("─".repeat(60)));
          this.log(
            formatWarning(
              "No cursor updates are being sent in this space. Make sure other clients are actively setting cursor positions.",
            ),
          );
          return;
        }

        if (cursors.length === 0) {
          this.log(chalk.dim("─".repeat(60)));
          this.log(formatWarning("No active cursors found in space."));
          return;
        }

        // Show summary table
        this.log(chalk.dim("─".repeat(60)));
        this.log(
          `\n${formatHeading("Cursor Summary")} - ${formatCountLabel(cursors.length, "cursor")} found:\n`,
        );

        // Table header
        const colWidths = { client: 20, x: 8, y: 8, connection: 20 };
        this.log(
          chalk.gray(
            "┌" +
              "─".repeat(colWidths.client + 2) +
              "┬" +
              "─".repeat(colWidths.x + 2) +
              "┬" +
              "─".repeat(colWidths.y + 2) +
              "┬" +
              "─".repeat(colWidths.connection + 2) +
              "┐",
          ),
        );
        this.log(
          chalk.gray("│ ") +
            chalk.bold("Client ID".padEnd(colWidths.client)) +
            chalk.gray(" │ ") +
            chalk.bold("X".padEnd(colWidths.x)) +
            chalk.gray(" │ ") +
            chalk.bold("Y".padEnd(colWidths.y)) +
            chalk.gray(" │ ") +
            chalk.bold("connection".padEnd(colWidths.connection)) +
            chalk.gray(" │"),
        );
        this.log(
          chalk.gray(
            "├" +
              "─".repeat(colWidths.client + 2) +
              "┼" +
              "─".repeat(colWidths.x + 2) +
              "┼" +
              "─".repeat(colWidths.y + 2) +
              "┼" +
              "─".repeat(colWidths.connection + 2) +
              "┤",
          ),
        );

        // Table rows
        cursors.forEach((cursor: CursorUpdate) => {
          const clientId = (cursor.clientId || "Unknown").slice(
            0,
            colWidths.client,
          );
          const x = cursor.position.x.toString().slice(0, colWidths.x);
          const y = cursor.position.y.toString().slice(0, colWidths.y);
          const connectionId = (cursor.connectionId || "Unknown").slice(
            0,
            colWidths.connection,
          );

          this.log(
            chalk.gray("│ ") +
              formatClientId(clientId.padEnd(colWidths.client)) +
              chalk.gray(" │ ") +
              chalk.yellow(x.padEnd(colWidths.x)) +
              chalk.gray(" │ ") +
              chalk.yellow(y.padEnd(colWidths.y)) +
              chalk.gray(" │ ") +
              chalk.dim(connectionId.padEnd(colWidths.connection)) +
              chalk.gray(" │"),
          );
        });

        this.log(
          chalk.gray(
            "└" +
              "─".repeat(colWidths.client + 2) +
              "┴" +
              "─".repeat(colWidths.x + 2) +
              "┴" +
              "─".repeat(colWidths.y + 2) +
              "┴" +
              "─".repeat(colWidths.connection + 2) +
              "┘",
          ),
        );

        // Show additional data if any cursor has it
        const cursorsWithData = cursors.filter((c) => c.data);
        if (cursorsWithData.length > 0) {
          this.log(`\n${formatHeading("Additional Data")}:`);
          cursorsWithData.forEach((cursor: CursorUpdate) => {
            this.log(
              `  ${formatClientId(cursor.clientId || "Unknown")}: ${JSON.stringify(cursor.data)}`,
            );
          });
        }
      }
    } catch (error) {
      this.fail(error, flags, "cursorGetAll", { spaceName });
    }
  }
}
