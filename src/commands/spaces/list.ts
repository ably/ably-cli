import { Flags } from "@oclif/core";

import { productApiFlags } from "../../flags.js";
import {
  formatCountLabel,
  formatLimitWarning,
  formatResource,
} from "../../utils/output.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";

interface SpaceItem {
  spaceName: string;
  channelId?: string;
  [key: string]: unknown;
}

export default class SpacesList extends SpacesBaseCommand {
  static override description = "List active spaces";

  static override examples = [
    "$ ably spaces list",
    "$ ably spaces list --prefix my-space",
    "$ ably spaces list --limit 50",
    "$ ably spaces list --json",
    "$ ably spaces list --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return (default: 100)",
    }),
    prefix: Flags.string({
      char: "p",
      description: "Filter spaces by prefix",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SpacesList);

    try {
      // REST client for channel enumeration
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      interface ChannelParams {
        limit: number;
        prefix?: string;
      }

      const params: ChannelParams = {
        limit: flags.limit * 5, // Request more to allow for filtering
      };

      if (flags.prefix) {
        params.prefix = flags.prefix;
      }

      const channelsResponse = await rest.request(
        "get",
        "/channels",
        2,
        params,
      );

      if (channelsResponse.statusCode !== 200) {
        this.fail(
          `Failed to list spaces: ${channelsResponse.statusCode}`,
          flags,
          "spaceList",
        );
      }

      const allChannels = channelsResponse.items || [];
      const spaces = new Map<string, SpaceItem>();

      for (const channel of allChannels) {
        const { channelId } = channel;

        if (channelId.includes("::$space")) {
          const spaceNameMatch = channelId.match(/^(.+?)::\$space.*$/);
          if (spaceNameMatch && spaceNameMatch[1]) {
            const spaceName = spaceNameMatch[1];
            if (!spaces.has(spaceName)) {
              spaces.set(spaceName, {
                channelId: spaceName,
                spaceName,
              });
            }
          }
        }
      }

      const spacesList = [...spaces.values()];
      const limitedSpaces = spacesList.slice(0, flags.limit);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            spaces: limitedSpaces.map((space: SpaceItem) => ({
              spaceName: space.spaceName,
            })),
          },
          flags,
        );
      } else {
        if (limitedSpaces.length === 0) {
          this.log("No active spaces found.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(limitedSpaces.length, "active space")}:\n`,
        );

        limitedSpaces.forEach((space: SpaceItem) => {
          this.log(`${formatResource(space.spaceName)}`);
        });

        const warning = formatLimitWarning(
          limitedSpaces.length,
          flags.limit,
          "spaces",
        );
        if (warning) this.log(`\n${warning}`);
      }
    } catch (error) {
      this.fail(error, flags, "spaceList");
    }
  }
}
