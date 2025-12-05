import { type Lock } from "@ably/spaces";
import { Args, Flags as _Flags } from "@oclif/core";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

export default class SpacesLocksSubscribe extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to subscribe to locks for",
      required: true,
    }),
  };

  static override description = "Subscribe to lock events in a space";

  static override examples = [
    "$ ably spaces locks subscribe my-space",
    "$ ably spaces locks subscribe my-space --json",
    "$ ably spaces locks subscribe my-space --pretty-json",
    "$ ably spaces locks subscribe my-space --duration 30",
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

  private listener: ((lock: Lock) => void) | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocksSubscribe);
    const { space: spaceName } = args;
    this.logCliEvent(
      flags,
      "subscribe.run",
      "start",
      `Starting spaces locks subscribe for space: ${spaceName}`,
    );

    try {
      // Always show the readiness signal first, before attempting auth
      if (!this.shouldOutputJson(flags)) {
        this.log("Subscribing to lock events");
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

      // Add listeners for connection state changes
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

      if (!this.shouldOutputJson(flags)) {
        this.log(`Connecting to space: ${chalk.cyan(spaceName)}...`);
      }

      // Get current locks
      this.logCliEvent(
        flags,
        "lock",
        "gettingInitial",
        "Fetching initial locks",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          `Fetching current locks for space ${chalk.cyan(spaceName)}...`,
        );
      }

      const locks = await this.space.locks.getAll();
      this.logCliEvent(
        flags,
        "lock",
        "gotInitial",
        `Fetched ${locks.length} initial locks`,
        { count: locks.length, locks },
      );

      // Output current locks
      if (locks.length === 0) {
        if (!this.shouldOutputJson(flags)) {
          this.log(
            chalk.yellow("No locks are currently active in this space."),
          );
        }
      } else if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              locks: locks.map((lock) => ({
                id: lock.id,
                member: lock.member,
                status: lock.status,
              })),
              spaceName,
              status: "connected",
              success: true,
            },
            flags,
          ),
        );
      } else {
        this.log(
          `\n${chalk.cyan("Current locks")} (${chalk.bold(locks.length.toString())}):\n`,
        );

        for (const lock of locks) {
          this.log(`- Lock ID: ${chalk.blue(lock.id)}`);
          this.log(`  ${chalk.dim("Status:")} ${lock.status}`);
          this.log(
            `  ${chalk.dim("Member:")} ${lock.member?.clientId || "Unknown"}`,
          );

          if (lock.member?.connectionId) {
            this.log(
              `  ${chalk.dim("Connection ID:")} ${lock.member.connectionId}`,
            );
          }
        }
      }

      // Subscribe to lock events
      this.logCliEvent(
        flags,
        "lock",
        "subscribing",
        "Subscribing to lock events",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(
          `\n${chalk.dim("Subscribing to lock events. Press Ctrl+C to exit.")}\n`,
        );
      }
      this.logCliEvent(
        flags,
        "lock.subscribe",
        "readySignalLogged",
        "Final readiness signal 'Subscribing to lock events' logged.",
      );

      // Define the listener function
      this.listener = (lock: Lock) => {
        const timestamp = new Date().toISOString();

        const eventData = {
          lock: {
            id: lock.id,
            member: lock.member,
            status: lock.status,
          },
          spaceName,
          timestamp,
          type: "lock_event",
        };

        this.logCliEvent(
          flags,
          "lock",
          "event-update",
          "Lock event received",
          eventData,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput({ success: true, ...eventData }, flags),
          );
        } else {
          this.log(`[${timestamp}] 🔒 Lock ${chalk.blue(lock.id)} updated`);
          this.log(`  ${chalk.dim("Status:")} ${lock.status}`);
          this.log(
            `  ${chalk.dim("Member:")} ${lock.member?.clientId || "Unknown"}`,
          );

          if (lock.member?.connectionId) {
            this.log(
              `  ${chalk.dim("Connection ID:")} ${lock.member.connectionId}`,
            );
          }
        }
      };

      // Subscribe using the stored listener
      await this.space.locks.subscribe(this.listener);

      this.logCliEvent(
        flags,
        "lock",
        "subscribed",
        "Successfully subscribed to lock events",
      );

      this.logCliEvent(
        flags,
        "lock",
        "listening",
        "Listening for lock events...",
      );

      // Wait until the user interrupts or the optional duration elapses
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      const errorMsg = `Error during execution: ${error instanceof Error ? error.message : String(error)}`;
      this.logCliEvent(flags, "lock", "executionError", errorMsg, {
        error: errorMsg,
      });
      if (!this.shouldOutputJson(flags)) {
        this.log(chalk.red(errorMsg));
      }
    } finally {
      // Cleanup is now handled by base class finally() method
    }
  }
}
