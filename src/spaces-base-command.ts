import * as Ably from "ably";
import Spaces, { type Space, type SpaceOptions } from "@ably/spaces";
import { AblyBaseCommand } from "./base-command.js";
import { BaseFlags } from "./types/cli.js";
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
  protected space: Space | null = null;
  protected spaces: Spaces | null = null;
  protected realtimeClient: Ably.Realtime | null = null;
  private parsedFlags: BaseFlags = {};

  async finally(error: Error | undefined): Promise<void> {
    // Always clean up connections
    try {
      // Unsubscribe from all namespace listeners
      if (this.space !== null) {
        try {
          await this.space.members.unsubscribe();
          await this.space.locks.unsubscribe();
          this.space.locations.unsubscribe();
          this.space.cursors.unsubscribe();
        } catch (error) {
          // Log but don't throw unsubscribe errors
          if (!this.shouldOutputJson(this.parsedFlags)) {
            this.debug(`Namespace unsubscribe error: ${error}`);
          }
        }

        await this.space!.leave();
        // Wait a bit after leaving space
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Spaces maintains an internal map of members which have timeouts. This keeps node alive.
        // This is a workaround to hold off until those timeouts are cleared by the client, as otherwise
        // we'll get unhandled presence rejections as the connection closes.
        await new Promise<void>((resolve) => {
          let intervalId: ReturnType<typeof setInterval>;
          const maxWaitMs = 10000; // 10 second timeout
          const startTime = Date.now();
          const getAll = async () => {
            // Avoid waiting forever
            if (Date.now() - startTime > maxWaitMs) {
              clearInterval(intervalId);
              this.debug("Timed out waiting for space members to clear");
              resolve();
              return;
            }

            const members = await this.space!.members.getAll();
            if (members.filter((member) => !member.isConnected).length === 0) {
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
    } catch (error) {
      // Log but don't throw cleanup errors
      if (!this.shouldOutputJson(this.parsedFlags)) {
        this.debug(`Space leave error: ${error}`);
      }
    }

    super.finally(error);
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
      this.error("Failed to create Ably client");
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

      this.error(`No mock Ably Spaces client available in test mode`);
    }

    const Spaces = await getSpacesConstructor();
    return new Spaces(realtimeClient) as Spaces;
  }
}
