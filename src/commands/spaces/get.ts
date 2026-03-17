import { Args } from "@oclif/core";

import { productApiFlags } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import {
  formatCountLabel,
  formatHeading,
  formatIndex,
  formatProgress,
  formatResource,
} from "../../utils/output.js";
import { formatMemberBlock } from "../../utils/spaces-output.js";
import type { MemberOutput } from "../../utils/spaces-output.js";

const SPACE_CHANNEL_TAG = "::$space";

export default class SpacesGet extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get",
      required: true,
    }),
  };

  static override description = "Get the current state of a space";

  static override examples = [
    "$ ably spaces get my-space",
    "$ ably spaces get my-space --json",
    "$ ably spaces get my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesGet);
    const { space: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching state for space ${formatResource(spaceName)}`,
          ),
        );
      }

      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channelName = `${spaceName}${SPACE_CHANNEL_TAG}`;
      const presenceResponse = await rest.request(
        "get",
        `/channels/${encodeURIComponent(channelName)}/presence`,
        2,
        {},
      );

      if (presenceResponse.statusCode !== 200) {
        this.fail(
          `Failed to fetch space state: ${presenceResponse.statusCode}`,
          flags,
          "spaceGet",
          { spaceName },
        );
      }

      const items = presenceResponse.items || [];

      if (items.length === 0) {
        this.fail(
          `Space ${spaceName} not found (no members currently present). Spaces only exist while members are present.`,
          flags,
          "spaceGet",
          { spaceName },
        );
      }

      const members: MemberOutput[] = items.map(
        (item: {
          clientId: string;
          connectionId: string;
          action: string;
          timestamp: number;
          data?: {
            profileUpdate?: { current?: Record<string, unknown> };
            locationUpdate?: { current?: unknown };
          };
        }) => ({
          clientId: item.clientId,
          connectionId: item.connectionId,
          isConnected: item.action !== "leave" && item.action !== "absent",
          profileData: item.data?.profileUpdate?.current ?? null,
          location: item.data?.locationUpdate?.current ?? null,
          lastEvent: {
            name: item.action,
            timestamp: item.timestamp,
          },
        }),
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            space: {
              name: spaceName,
              members,
            },
          },
          flags,
        );
      } else {
        this.log(`\n${formatHeading("Space:")} ${formatResource(spaceName)}\n`);
        this.log(
          `${formatHeading("Members")} (${formatCountLabel(members.length, "member")}):\n`,
        );

        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          this.log(`${formatIndex(i + 1)}`);
          // Use manual formatting since we have MemberOutput, not SpaceMember
          this.log(
            formatMemberBlock(
              {
                clientId: member.clientId,
                connectionId: member.connectionId,
                isConnected: member.isConnected,
                profileData: member.profileData as Record<string, unknown>,
                location: member.location,
                lastEvent: member.lastEvent as {
                  name: string;
                  timestamp: number;
                },
              } as import("@ably/spaces").SpaceMember,
              { indent: "  " },
            ),
          );
          this.log("");
        }
      }
    } catch (error) {
      this.fail(error, flags, "spaceGet", { spaceName });
    }
  }
}
