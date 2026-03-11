import { type CursorUpdate } from "@ably/spaces";
import { Args } from "@oclif/core";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatListening,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatClientId,
  formatLabel,
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
              eventType: "cursor_update",
            };
            this.logCliEvent(
              flags,
              "cursor",
              "updateReceived",
              "Cursor update received",
              eventData,
            );

            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent(eventData, flags);
            } else {
              // Include data field in the output if present
              const dataString = cursorUpdate.data
                ? ` data: ${JSON.stringify(cursorUpdate.data)}`
                : "";
              this.log(
                `${formatTimestamp(timestamp)} ${formatClientId(cursorUpdate.clientId)} ${formatLabel("position")} ${JSON.stringify(cursorUpdate.position)}${dataString}`,
              );
            }
          } catch (error) {
            this.fail(error, flags, "CursorSubscribe", {
              spaceName,
            });
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
        this.fail(error, flags, "CursorSubscribe", {
          spaceName,
        });
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
        this.log(
          formatSuccess(`Subscribed to space: ${formatResource(spaceName)}.`),
        );
        this.log(formatListening("Listening for cursor movements."));
      }

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "cursor", flags.duration);
    } catch (error) {
      this.fail(error, flags, "CursorSubscribe", { spaceName });
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
