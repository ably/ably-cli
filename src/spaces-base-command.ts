import * as Ably from "ably";
import Spaces, { type Space, type SpaceOptions } from "@ably/spaces";
import { AblyBaseCommand } from "./base-command.js";
import { productApiFlags } from "./flags.js";
import { BaseFlags } from "./types/cli.js";
import { errorMessage } from "./utils/errors.js";
import isTestMode from "./utils/test-mode.js";

// Dynamic import to handle module structure issues
let SpacesConstructor: (new (client: Ably.Realtime) => unknown) | null = null;

async function getSpacesConstructor(): Promise<
  new (client: Ably.Realtime) => unknown
> {
  if (!SpacesConstructor) {
    const spacesModule = (await import("@ably/spaces")) as unknown;
    const moduleAsRecord = spacesModule as Record<string, unknown>;
    const defaultProperty = moduleAsRecord.default as
      | Record<string, unknown>
      | undefined;
    SpacesConstructor = (defaultProperty?.default ||
      moduleAsRecord.default ||
      moduleAsRecord) as new (client: Ably.Realtime) => unknown;
  }
  return SpacesConstructor;
}

export abstract class SpacesBaseCommand extends AblyBaseCommand {
  static globalFlags = { ...productApiFlags };
  protected space: Space | null = null;
  protected spaces: Spaces | null = null;
  protected realtimeClient: Ably.Realtime | null = null;
  protected parsedFlags: BaseFlags = {};
  protected hasEnteredSpace = false;

  protected markAsEntered(): void {
    this.hasEnteredSpace = true;
  }

  /**
   * Enter the space and mark as entered in one call.
   * Always use this instead of calling space.enter() + markAsEntered() separately
   * to ensure cleanup (space.leave()) is never accidentally skipped.
   */
  protected async enterCurrentSpace(
    flags: BaseFlags,
    profileData?: Record<string, unknown>,
  ): Promise<void> {
    this.logCliEvent(flags, "spaces", "entering", "Entering space...");
    await this.space!.enter(profileData);
    this.markAsEntered();
    this.logCliEvent(flags, "spaces", "entered", "Entered space", {
      clientId: this.realtimeClient!.auth.clientId,
    });
  }

  async finally(error: Error | undefined): Promise<void> {
    // The Spaces SDK subscribes to channel.presence internally (in the Space
    // constructor) but provides no dispose/cleanup method. When the connection
    // closes, the SDK's internal handlers receive errors that surface as
    // unhandled rejections crashing the process. We suppress these during
    // cleanup, matching the ChatBaseCommand pattern of tolerating SDK errors
    // during teardown.
    const suppressedErrors: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      suppressedErrors.push(reason);
      this.debug(`Suppressed unhandled rejection during cleanup: ${reason}`);
    };

    process.on("unhandledRejection", onUnhandledRejection);

    try {
      if (this.space !== null) {
        // Unsubscribe from all namespace listeners
        try {
          await this.space.members.unsubscribe();
          await this.space.locks.unsubscribe();
          this.space.locations.unsubscribe();
          this.space.cursors.unsubscribe();
        } catch (error) {
          this.debug(`Namespace unsubscribe error: ${error}`);
        }

        // Unsubscribe the SDK's internal presence handler on the space channel.
        // This removes the Spaces SDK's listener but cannot fully prevent
        // errors from the Ably SDK's own channel state transitions during close.
        // NOTE: Accesses @ably/spaces internal `Space.channel` property (verified
        // against @ably/spaces v0.4.0). The SDK has no public dispose() method.
        // If this breaks after a Spaces SDK upgrade, check the Space class for
        // a renamed/removed `channel` property or a new cleanup API.
        try {
          const spaceChannel = (
            this.space as unknown as { channel: Ably.RealtimeChannel }
          ).channel;
          if (spaceChannel) {
            spaceChannel.presence.unsubscribe();
          }
        } catch (error) {
          this.debug(`Space channel presence unsubscribe error: ${error}`);
        }

        // Only leave and wait for member cleanup if we actually entered the space
        if (this.hasEnteredSpace) {
          await this.space!.leave();
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Spaces maintains an internal map of members which have timeouts. This keeps node alive.
          // This is a workaround to hold off until those timeouts are cleared by the client, as otherwise
          // we'll get unhandled presence rejections as the connection closes.
          await new Promise<void>((resolve) => {
            let intervalId: ReturnType<typeof setInterval>;
            const maxWaitMs = 10000;
            const startTime = Date.now();
            const getAll = async () => {
              if (Date.now() - startTime > maxWaitMs) {
                clearInterval(intervalId);
                this.debug("Timed out waiting for space members to clear");
                resolve();
                return;
              }

              const members = await this.space!.members.getAll();
              if (
                members.filter((member) => !member.isConnected).length === 0
              ) {
                clearInterval(intervalId);
                this.debug("space members cleared");
                resolve();
              } else {
                this.debug(
                  `waiting for spaces members to clear, ${members.length} remaining`,
                );
              }
            };

            intervalId = setInterval(() => {
              getAll();
            }, 1000);
          });
        }
      }
    } catch (error) {
      this.debug(`Space cleanup error: ${error}`);
    }

    await super.finally(error);

    // Allow a tick for any remaining SDK-internal rejections to fire
    // before removing the suppression handler.
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.removeListener("unhandledRejection", onUnhandledRejection);
  }

  // Ensure we have the spaces client and its related authentication resources
  protected async setupSpacesClient(
    flags: BaseFlags,
    spaceName: string,
  ): Promise<{
    realtimeClient: Ably.Realtime;
    spacesClient: unknown;
    space: Space;
  }> {
    if (this.spaces) {
      return {
        spacesClient: this.spaces,
        space: this.space!,
        realtimeClient: this.realtimeClient!,
      };
    }

    // First create an Ably client
    this.realtimeClient = await this.createAblyRealtimeClient(flags);
    if (!this.realtimeClient) {
      this.fail("Failed to create Ably client", flags, "client");
    }

    // Create a Spaces client using the Ably client
    this.spaces = await this.createSpacesClient(this.realtimeClient);

    // We set the offline timeout to 2s otherwise Spaces will hang on to left members for 2 minutes.
    const options: Partial<SpaceOptions> = {
      offlineTimeout: 2000,
    };

    // Get a space instance with the provided name
    this.space = await this.spaces.get(spaceName, options);

    return {
      realtimeClient: this.realtimeClient,
      space: this.space!,
      spacesClient: this.spaces!,
    };
  }

  protected async waitForConnection(flags: BaseFlags): Promise<void> {
    this.logCliEvent(
      flags,
      "connection",
      "waiting",
      "Waiting for connection to establish...",
    );
    const connection = this.realtimeClient!.connection;

    if (connection.state === "connected") {
      this.logCliEvent(
        flags,
        "connection",
        "connected",
        "Realtime connection established.",
      );
      return;
    }

    if (
      connection.state === "failed" ||
      connection.state === "closed" ||
      connection.state === "suspended"
    ) {
      const errorMsg = `Connection failed with state: ${connection.state}`;
      this.logCliEvent(flags, "connection", "failed", errorMsg, {
        state: connection.state,
      });
      this.fail(errorMsg, flags, "connection");
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for connection to establish"));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        connection.off("connected", onConnected);
        connection.off("failed", onFailed);
        connection.off("closed", onClosed);
        connection.off("suspended", onSuspended);
      };

      const onConnected = () => {
        cleanup();
        this.logCliEvent(
          flags,
          "connection",
          "connected",
          "Realtime connection established.",
        );
        resolve();
      };

      const onFailed = (stateChange: Ably.ConnectionStateChange) => {
        cleanup();
        const errorMsg = `Connection failed: ${stateChange.reason?.message || "Unknown error"}`;
        this.logCliEvent(flags, "connection", "failed", errorMsg, {
          state: "failed",
        });
        reject(new Error(errorMsg));
      };

      const onClosed = () => {
        cleanup();
        reject(new Error("Connection closed unexpectedly"));
      };

      const onSuspended = () => {
        cleanup();
        reject(new Error("Connection suspended"));
      };

      connection.on("connected", onConnected);
      connection.on("failed", onFailed);
      connection.on("closed", onClosed);
      connection.on("suspended", onSuspended);
    });
  }

  protected async initializeSpace(
    flags: BaseFlags,
    spaceName: string,
    options: { enterSpace?: boolean; setupConnectionLogging?: boolean } = {},
  ): Promise<void> {
    const { enterSpace = false, setupConnectionLogging = true } = options;

    const setupResult = await this.setupSpacesClient(flags, spaceName);
    this.realtimeClient = setupResult.realtimeClient;
    this.space = setupResult.space;
    if (!this.realtimeClient || !this.space) {
      this.fail("Failed to initialize clients or space", flags, "client");
    }

    if (setupConnectionLogging) {
      this.setupConnectionStateLogging(this.realtimeClient!, flags, {
        includeUserFriendlyMessages: true,
      });
    }

    await this.waitForConnection(flags);

    // Store flags for use in cleanup/finally blocks (e.g. SpacesBaseCommand.finally())
    this.parsedFlags = flags;

    if (enterSpace) {
      await this.enterCurrentSpace(flags);
    }
  }

  protected async waitForCursorsChannelAttachment(
    flags: BaseFlags,
  ): Promise<void> {
    this.logCliEvent(
      flags,
      "cursor",
      "waitingForChannelAttachment",
      "Waiting for cursors channel to attach before subscribing",
    );

    // Trigger channel creation by accessing the cursors API
    try {
      await this.space!.cursors.getAll();
      this.logCliEvent(
        flags,
        "cursor",
        "channelCreated",
        "Cursors channel created via getAll()",
      );
    } catch (error) {
      this.logCliEvent(
        flags,
        "cursor",
        "channelCreationAttempted",
        "Attempted to create cursors channel",
        {
          error: errorMessage(error),
        },
      );
    }

    // Wait for the channel to be attached
    if (this.space!.cursors.channel) {
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
          reject(new Error("Timeout waiting for cursors channel to attach"));
        }, 10000);
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
      this.logCliEvent(
        flags,
        "cursor",
        "channelNotAvailable",
        "Warning: cursors channel not available after creation attempt",
      );
    }
  }

  protected async createSpacesClient(
    realtimeClient: Ably.Realtime,
  ): Promise<Spaces> {
    // If in test mode, skip connection and use mock
    if (isTestMode()) {
      this.debug(`Running in test mode, using mock Ably Spaces client`);
      const mockAblySpaces = this.getMockAblySpaces();

      if (mockAblySpaces) {
        // Return mock as appropriate type
        return mockAblySpaces;
      }

      this.fail(
        "No mock Ably Spaces client available in test mode",
        {},
        "client",
      );
    }

    const Spaces = await getSpacesConstructor();
    return new Spaces(realtimeClient) as Spaces;
  }
}
