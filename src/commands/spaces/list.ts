import { Flags } from "@oclif/core";

import { productApiFlags } from "../../flags.js";
import {
  formatCountLabel,
  formatLimitWarning,
  formatResource,
} from "../../utils/output.js";
import {
  buildPaginationNext,
  collectFilteredPaginatedResults,
  formatPaginationWarning,
} from "../../utils/pagination.js";
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
      description: "Maximum number of results to return",
      min: 1,
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

      // Build params for channel listing
      // Request 5x the user's limit (capped at the API max of 1000) because
      // client-side filtering (only ::$space channels, deduplicated by space name)
      // yields ~1 space per 3-5 raw channels. This minimizes API round trips.
      // collectFilteredPaginatedResults fetches additional pages if still needed.
      const params: { limit: number; prefix?: string } = {
        limit: Math.min(flags.limit * 5, 1000),
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

      // Use filtered pagination to collect space channels, deduplicate by space name
      const seenSpaces = new Set<string>();
      const {
        items: limitedSpaces,
        hasMore,
        pagesConsumed,
      } = await collectFilteredPaginatedResults<SpaceItem>(
        channelsResponse,
        flags.limit,
        (channel: SpaceItem) => {
          const { channelId } = channel;
          if (!channelId) return false;
          const spaceNameMatch = channelId.match(/^(.+?)::\$space(?:$|::)/);
          if (!spaceNameMatch || !spaceNameMatch[1]) return false;
          const spaceName = spaceNameMatch[1];
          if (seenSpaces.has(spaceName)) return false;
          seenSpaces.add(spaceName);
          return true;
        },
      );

      // Normalize names in a separate step (keep filter as pure predicate)
      const spaces = limitedSpaces.map((s) => {
        const match = s.channelId!.match(/^(.+?)::\$space(?:$|::)/)!;
        return { ...s, channelId: match[1], spaceName: match[1] };
      });

      const paginationWarning = formatPaginationWarning(
        pagesConsumed,
        spaces.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.log(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        const next = buildPaginationNext(hasMore);
        this.logJsonResult(
          {
            spaces: spaces.map((space) => ({
              spaceName: space.spaceName,
            })),
            hasMore,
            ...(next && { next }),
            timestamp: new Date().toISOString(),
            total: spaces.length,
          },
          flags,
        );
      } else {
        if (spaces.length === 0 && !hasMore) {
          this.log("No active spaces found.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(spaces.length, "active space")}:\n`,
        );

        spaces.forEach((space) => {
          this.log(`${formatResource(space.spaceName)}`);
        });

        if (hasMore) {
          const warning = formatLimitWarning(
            spaces.length,
            flags.limit,
            "spaces",
          );
          if (warning) this.log(`\n${warning}`);
        }
      }
    } catch (error) {
      this.fail(error, flags, "spaceList");
    }
  }
}
