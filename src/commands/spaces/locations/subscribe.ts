import type { LocationsEvents } from "@ably/spaces";
import { Args, Flags as _Flags } from "@oclif/core";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

// Define interfaces for location types
interface SpaceMember {
  clientId: string;
  connectionId: string;
  isConnected: boolean;
  profileData: Record<string, unknown> | null;
}

interface LocationData {
  [key: string]: unknown;
}

interface LocationItem {
  location: LocationData;
  member: SpaceMember;
}

// Define type for subscription

export default class SpacesLocationsSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to locations for",
      required: true,
    }),
  };

  static override description =
    "Subscribe to location updates for members in a space";

  static override examples = [
    "$ ably spaces locations subscribe my-space",
    "$ ably spaces locations subscribe my-space --json",
    "$ ably spaces locations subscribe my-space --pretty-json",
    "$ ably spaces locations subscribe my-space --duration 30",
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

  private cleanupInProgress = false;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsSubscribe);
    const { space: spaceName } = args;
    this.logCliEvent(
      flags,
      "subscribe.run",
      "start",
      `Starting spaces locations subscribe for space: ${spaceName}`,
    );

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log("Subscribing to location updates");
      }
      this.logCliEvent(
        flags,
        "subscribe.run",
        "initialSignalLogged",
        "Initial readiness signal logged.",
      );

      // Create Spaces client using setupSpacesClient
      this.logCliEvent(
        flags,
        "subscribe.clientSetup",
        "attemptingClientCreation",
        "Attempting to create Spaces and Ably clients.",
      );
      const setupResult = await this.setupSpacesClient(flags, spaceName);
      this.realtimeClient = setupResult.realtimeClient;
      this.space = setupResult.space;
      if (!this.realtimeClient || !this.space) {
        this.logCliEvent(
          flags,
          "subscribe.clientSetup",
          "clientCreationFailed",
          "Client or space setup failed.",
        );
        this.error("Failed to initialize clients or space");
        return;
      }
      this.logCliEvent(
        flags,
        "subscribe.clientSetup",
        "clientCreationSuccess",
        "Spaces and Ably clients created.",
      );

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
          const { state } = this.realtimeClient!.connection;
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
      if (!this.shouldOutputJson(flags)) {
        this.log(`Connecting to space: ${chalk.cyan(spaceName)}...`);
      }

      this.logCliEvent(
        flags,
        "spaces",
        "gotSpace",
        `Successfully got space handle: ${spaceName}`,
      );

      // Enter the space
      this.logCliEvent(flags, "spaces", "entering", "Entering space...");
      await this.space.enter();
      this.logCliEvent(
        flags,
        "spaces",
        "entered",
        "Successfully entered space",
        { clientId: this.realtimeClient!.auth.clientId },
      );

      // Get current locations
      this.logCliEvent(
        flags,
        "location",
        "gettingInitial",
        `Fetching initial locations for space ${spaceName}`,
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          `Fetching current locations for space ${chalk.cyan(spaceName)}...`,
        );
      }

      let locations: LocationItem[] = [];
      try {
        const result = await this.space.locations.getAll();
        this.logCliEvent(
          flags,
          "location",
          "gotInitial",
          `Fetched initial locations`,
          { locations: result },
        );

        if (result && typeof result === "object") {
          if (Array.isArray(result)) {
            // Unlikely based on current docs, but handle if API changes
            // Need to map Array result to LocationItem[] if structure differs
            this.logCliEvent(
              flags,
              "location",
              "initialFormatWarning",
              "Received array format for initial locations, expected object",
            );
            // Assuming array elements match expected structure for now:
            locations = result.map(
              (item: { location: LocationData; member: SpaceMember }) => ({
                location: item.location,
                member: item.member,
              }),
            );
          } else if (Object.keys(result).length > 0) {
            // Standard case: result is an object { connectionId: locationData }
            locations = Object.entries(result).map(
              ([connectionId, locationData]) => ({
                location: locationData as LocationData,
                member: {
                  // Construct a partial SpaceMember as SDK doesn't provide full details here
                  clientId: "unknown", // clientId not directly available in getAll response
                  connectionId,
                  isConnected: true, // Assume connected for initial state
                  profileData: null,
                },
              }),
            );
          }
        }

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                locations: locations.map((item) => ({
                  // Map to a simpler structure for output if needed
                  connectionId: item.member.connectionId,
                  location: item.location,
                })),
                spaceName,
                success: true,
                type: "locations_snapshot",
              },
              flags,
            ),
          );
        } else if (locations.length === 0) {
          this.log(
            chalk.yellow("No locations are currently set in this space."),
          );
        } else {
          this.log(
            `\n${chalk.cyan("Current locations")} (${chalk.bold(locations.length.toString())}):\n`,
          );
          for (const item of locations) {
            this.log(
              `- Connection ID: ${chalk.blue(item.member.connectionId || "Unknown")}`,
            ); // Use connectionId as key
            this.log(
              `  ${chalk.dim("Location:")} ${JSON.stringify(item.location)}`,
            );
          }
        }
      } catch (error) {
        const errorMsg = `Error fetching locations: ${error instanceof Error ? error.message : String(error)}`;
        this.logCliEvent(flags, "location", "getInitialError", errorMsg, {
          error: errorMsg,
          spaceName,
        });
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            { error: errorMsg, spaceName, status: "error", success: false },
            flags,
          );
        } else {
          this.log(chalk.yellow(errorMsg));
        }
      }

      this.logCliEvent(
        flags,
        "location",
        "subscribing",
        "Subscribing to location updates",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          `\n${chalk.dim("Subscribing to location updates. Press Ctrl+C to exit.")}\n`,
        );
      }
      this.logCliEvent(
        flags,
        "location.subscribe",
        "readySignalLogged",
        "Final readiness signal 'Subscribing to location updates' logged.",
      );

      try {
        // Define the location update handler
        const locationHandler = (update: LocationsEvents.UpdateEvent) => {
          try {
            const timestamp = new Date().toISOString();
            const eventData = {
              action: "update",
              location: update.currentLocation,
              member: {
                clientId: update.member.clientId,
                connectionId: update.member.connectionId,
              },
              previousLocation: update.previousLocation,
              timestamp,
            };
            this.logCliEvent(
              flags,
              "location",
              "updateReceived",
              "Location update received",
              { spaceName, ...eventData },
            );

            if (this.shouldOutputJson(flags)) {
              this.log(
                this.formatJsonOutput(
                  {
                    spaceName,
                    success: true,
                    type: "location_update",
                    ...eventData,
                  },
                  flags,
                ),
              );
            } else {
              this.log(
                `[${timestamp}] ${chalk.blue(update.member.clientId)} ${chalk.yellow("updated")} location:`,
              );
              this.log(
                `  ${chalk.dim("Current:")} ${JSON.stringify(update.currentLocation)}`,
              );
              this.log(
                `  ${chalk.dim("Previous:")} ${JSON.stringify(update.previousLocation)}`,
              );
            }
          } catch (error) {
            const errorMsg = `Error processing location update: ${error instanceof Error ? error.message : String(error)}`;
            this.logCliEvent(
              flags,
              "location",
              "updateProcessError",
              errorMsg,
              { error: errorMsg, spaceName },
            );
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

        // Subscribe to location updates
        this.space.locations.subscribe("update", locationHandler);

        this.logCliEvent(
          flags,
          "location",
          "subscribed",
          "Successfully subscribed to location updates",
        );
      } catch (error) {
        const errorMsg = `Error subscribing to location updates: ${error instanceof Error ? error.message : String(error)}`;
        this.logCliEvent(flags, "location", "subscribeError", errorMsg, {
          error: errorMsg,
          spaceName,
        });
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            { error: errorMsg, spaceName, status: "error", success: false },
            flags,
          );
        } else {
          this.log(chalk.red(errorMsg));
        }
      }

      this.logCliEvent(
        flags,
        "location",
        "listening",
        "Listening for location updates...",
      );

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
      this.logCliEvent(flags, "location", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal";
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "location",
        "fatalError",
        `Failed to subscribe to location updates: ${errorMsg}`,
        { error: errorMsg, spaceName },
      );
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { error: errorMsg, spaceName, status: "error", success: false },
          flags,
        );
      } else {
        this.error(`Failed to subscribe to location updates: ${errorMsg}`);
      }
    } finally {
      // Wrap all cleanup in a timeout to prevent hanging
      if (!this.shouldOutputJson(flags || {})) {
        if (this.cleanupInProgress) {
          this.log(chalk.green("Graceful shutdown complete (user interrupt)."));
        } else {
          this.log(chalk.green("Duration elapsed – command finished cleanly."));
        }
      }
    }
  }
}
