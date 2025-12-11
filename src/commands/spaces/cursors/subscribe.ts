import { type CursorUpdate } from "@ably/spaces";
import { Args, Flags as _Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

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
    ...SpacesBaseCommand.globalFlags,
    duration: _Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
  };

  private listener: ((update: CursorUpdate) => void) | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCursorsSubscribe);
    this.parsedFlags = flags;
    const { space: spaceName } = args;

    try {
      // Create Spaces client using setupSpacesClient
      const setupResult = await this.setupSpacesClient(flags, spaceName);
      this.realtimeClient = setupResult.realtimeClient;
      this.space = setupResult.space;
      if (!this.realtimeClient || !this.space) {
        this.error("Failed to initialize clients or space");
        return;
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.realtimeClient, flags, {
        includeUserFriendlyMessages: true,
      });

      // Make sure we have a connection before proceeding
      this.logCliEvent(
        flags,
        "connection",
        "waiting",
        "Waiting for connection to establish...",
      );
      await new Promise<void>((resolve, reject) => {
        const checkConnection = () => {
          const state = this.realtimeClient!.connection.state;
          if (state === "connected") {
            this.logCliEvent(
              flags,
              "connection",
              "connected",
              "Realtime connection established.",
            );
            resolve();
          } else if (
            state === "failed" ||
            state === "closed" ||
            state === "suspended"
          ) {
            const errorMsg = `Connection failed with state: ${state}`;
            this.logCliEvent(flags, "connection", "failed", errorMsg, {
              state,
            });
            reject(new Error(errorMsg));
          } else {
            // Still connecting, check again shortly
            setTimeout(checkConnection, 100);
          }
        };

        checkConnection();
      });

      // Get the space
      this.logCliEvent(
        flags,
        "spaces",
        "gettingSpace",
        `Getting space: ${spaceName}...`,
      );

      this.logCliEvent(
        flags,
        "spaces",
        "gotSpace",
        `Successfully got space handle: ${spaceName}`,
      );

      // Enter the space
      this.logCliEvent(flags, "spaces", "entering", "Entering space...");
      await this.space.enter();
      const clientId = this.realtimeClient!.auth.clientId ?? "unknown-client";
      this.logCliEvent(
        flags,
        "spaces",
        "entered",
        `Entered space ${spaceName} with clientId ${clientId}`,
      );

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
                `[${timestamp}] ${chalk.blue(cursorUpdate.clientId)} ${chalk.dim("position:")} ${JSON.stringify(cursorUpdate.position)}${dataString}`,
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
              this.log(chalk.red(errorMsg));
            }
          }
        };

        // Workaround for known SDK issue: cursors.subscribe() fails if the underlying ::$cursors channel is not attached
        // This will be fixed upstream in the Spaces SDK - see https://github.com/ably/spaces/issues/XXX
        this.logCliEvent(
          flags,
          "cursor",
          "waitingForChannelAttachment",
          "Waiting for cursors channel to attach before subscribing",
        );

        // First, trigger channel creation by accessing the cursors API
        // This ensures the channel exists before we try to wait for it to attach
        try {
          await this.space.cursors.getAll();
          this.logCliEvent(
            flags,
            "cursor",
            "channelCreated",
            "Cursors channel created via getAll()",
          );
        } catch (error) {
          // getAll() might fail if no cursors exist yet, but it should still create the channel
          this.logCliEvent(
            flags,
            "cursor",
            "channelCreationAttempted",
            "Attempted to create cursors channel",
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }

        // Now wait for the channel to be attached
        if (this.space.cursors.channel) {
          await new Promise<void>((resolve, reject) => {
            const channel = this.space!.cursors.channel;

            if (!channel) {
              reject(new Error("Cursors channel is not available"));
              return;
            }

            if (channel.state === "attached") {
              this.logCliEvent(
                flags,
                "cursor",
                "channelAlreadyAttached",
                "Cursors channel already attached",
              );
              resolve();
              return;
            }

            const timeout = setTimeout(() => {
              channel.off("attached", onAttached);
              channel.off("failed", onFailed);
              reject(
                new Error("Timeout waiting for cursors channel to attach"),
              );
            }, 10000); // 10 second timeout

            const onAttached = () => {
              clearTimeout(timeout);
              channel.off("attached", onAttached);
              channel.off("failed", onFailed);
              this.logCliEvent(
                flags,
                "cursor",
                "channelAttached",
                "Cursors channel attached successfully",
              );
              resolve();
            };

            const onFailed = (stateChange: Ably.ChannelStateChange) => {
              clearTimeout(timeout);
              channel.off("attached", onAttached);
              channel.off("failed", onFailed);
              reject(
                new Error(
                  `Cursors channel failed to attach: ${stateChange.reason?.message || "Unknown error"}`,
                ),
              );
            };

            channel.on("attached", onAttached);
            channel.on("failed", onFailed);

            this.logCliEvent(
              flags,
              "cursor",
              "waitingForAttachment",
              `Cursors channel state: ${channel.state}, waiting for attachment`,
            );
          });
        } else {
          // If channel still doesn't exist after getAll(), log a warning but continue
          this.logCliEvent(
            flags,
            "cursor",
            "channelNotAvailable",
            "Warning: cursors channel not available after creation attempt",
          );
        }

        // Subscribe using the listener
        await this.space.cursors.subscribe("update", this.listener);

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

      // Log the ready signal for E2E tests
      this.log("Subscribing to cursor movements");

      // Print success message
      if (!this.shouldOutputJson(flags)) {
        this.log(
          chalk.green(
            `✓ Subscribed to space: ${chalk.cyan(spaceName)}. Listening for cursor movements...`,
          ),
        );
      }

      // Wait until the user interrupts or the optional duration elapses
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "cursor",
        "fatalError",
        `Failed to subscribe to cursors: ${errorMsg}`,
        { error: errorMsg, spaceName },
      );
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { error: errorMsg, spaceName, status: "error", success: false },
          flags,
        );
      } else {
        this.error(`Failed to subscribe to cursors: ${errorMsg}`);
      }
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
