import * as Ably from "ably";
import Spaces, { type Space, type SpaceOptions } from "@ably/spaces";
import { AblyBaseCommand } from "./base-command.js";
import { BaseFlags } from "./types/cli.js";

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
  // Ensure we have the spaces client and its related authentication resources
  protected async setupSpacesClient(
    flags: BaseFlags,
    spaceName: string,
  ): Promise<{
    realtimeClient: Ably.Realtime;
    spacesClient: unknown;
    space: Space;
  }> {
    // First create an Ably client
    const realtimeClient = await this.createAblyRealtimeClient(flags);
    if (!realtimeClient) {
      this.error("Failed to create Ably client");
    }

    // Create a Spaces client using the Ably client
    const spacesClient = await this.createSpacesClient(realtimeClient);

    // We set the offline timeout to 1s otherwise Spaces will hang on to left members for 2 minutes.
    const options: Partial<SpaceOptions> = {
      offlineTimeout: 2000,
    };

    // Get a space instance with the provided name
    const space = await spacesClient.get(spaceName, options);

    return {
      realtimeClient,
      space,
      spacesClient,
    };
  }

  protected async createSpacesClient(
    realtimeClient: Ably.Realtime,
  ): Promise<Spaces> {
    // If in test mode, skip connection and use mock
    if (this.isTestMode()) {
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
