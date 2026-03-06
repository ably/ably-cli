import { type CursorUpdate } from "@ably/spaces";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";
import {
  listening,
  resource,
  success,
  formatTimestamp,
} from "../../../utils/output.js";

export default class SpacesCursorsSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to cursors for",
      required: true,
    }),
  };

  static override description = "Subscribe to cursor movements in a space";

  static override examples = [
    "$ ably spaces cursors subscribe my-space",
    "$ ably spaces cursors subscribe my-space --json",
    "$ ably spaces cursors subscribe my-space --pretty-json",
    "$ ably spaces cursors subscribe my-space --duration 30",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private listener: ((update: CursorUpdate) => void) | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCursorsSubscribe);
    const { space: spaceName } = args;

    try {
      await this.initializeSpace(flags, spaceName, { enterSpace: true });

      // Subscribe to cursor updates
      this.logCliEvent(
        flags,
        "cursor",
        "subscribing",
        "Subscribing to cursor updates",
      );

      try {
        // Define the listener function
        this.listener = (cursorUpdate: CursorUpdate) => {
          try {
            const timestamp = new Date().toISOString();
            const eventData = {
              member: {
                clientId: cursorUpdate.clientId,
                connectionId: cursorUpdate.connectionId,
              },
              position: cursorUpdate.position,
              data: cursorUpdate.data,
              spaceName,
              timestamp,
              type: "cursor_update",
            };
            this.logCliEvent(
              flags,
              "cursor",
              "updateReceived",
              "Cursor update received",
              eventData,
            );

            if (this.shouldOutputJson(flags)) {
              this.log(
                this.formatJsonOutput({ success: true, ...eventData }, flags),
              );
            } else {
              // Include data field in the output if present
              const dataString = cursorUpdate.data
                ? ` data: ${JSON.stringify(cursorUpdate.data)}`
                : "";
              this.log(
                `${formatTimestamp(timestamp)} ${chalk.blue(cursorUpdate.clientId)} ${chalk.dim("position:")} ${JSON.stringify(cursorUpdate.position)}${dataString}`,
              );
            }
          } catch (error) {
            const errorMsg = `Error processing cursor update: ${error instanceof Error ? error.message : String(error)}`;
            this.logCliEvent(flags, "cursor", "updateProcessError", errorMsg, {
              error: errorMsg,
              spaceName,
            });
            if (this.shouldOutputJson(flags)) {
              this.jsonError(
                {
                  error: errorMsg,
                  spaceName,
                  status: "error",
                  success: false,
                },
                flags,
              );
            } else {
              this.logToStderr(errorMsg);
            }
          }
        };

        // Workaround for known SDK issue: cursors.subscribe() fails if the underlying ::$cursors channel is not attached
        await this.waitForCursorsChannelAttachment(flags);

        // Subscribe using the listener
        await this.space!.cursors.subscribe("update", this.listener);

        this.logCliEvent(
          flags,
          "cursor",
          "subscribed",
          "Successfully subscribed to cursor updates",
        );
      } catch (error) {
        const errorMsg = `Error subscribing to cursor updates: ${error instanceof Error ? error.message : String(error)}`;
        this.logCliEvent(flags, "cursor", "subscribeError", errorMsg, {
          error: errorMsg,
          spaceName,
        });
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            { error: errorMsg, spaceName, status: "error", success: false },
            flags,
          );
        } else {
          this.log(
            chalk.yellow(
              "Will continue running, but may not receive cursor updates.",
            ),
          );
        }
      }

      this.logCliEvent(
        flags,
        "cursor",
        "listening",
        "Listening for cursor updates...",
      );

      if (!this.shouldOutputJson(flags)) {
        // Log the ready signal for E2E tests
        this.log("Subscribing to cursor movements");
      }

      // Print success message
      if (!this.shouldOutputJson(flags)) {
        this.log(success(`Subscribed to space: ${resource(spaceName)}.`));
        this.log(listening("Listening for cursor movements."));
      }

      // Wait until the user interrupts or the optional duration elapses
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      this.handleCommandError(error, flags, "cursor", { spaceName });
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
