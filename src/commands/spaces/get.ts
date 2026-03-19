import { Args } from "@oclif/core";

import { productApiFlags } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import {
  formatClientId,
  formatCountLabel,
  formatEventType,
  formatHeading,
  formatIndex,
  formatLabel,
  formatMessageTimestamp,
  formatProgress,
  formatResource,
} from "../../utils/output.js";

const SPACE_CHANNEL_TAG = "::$space";

interface PresenceItem {
  clientId: string;
  connectionId: string;
  action: string;
  timestamp: number;
  data?: {
    profileUpdate?: { current?: Record<string, unknown> };
    locationUpdate?: { current?: unknown };
  };
}

interface MemberInfo {
  clientId: string;
  connectionId: string;
  isConnected: boolean;
  profileData: Record<string, unknown> | null;
  location: unknown | null;
  lastEvent: { name: string; timestamp: number };
}

export default class SpacesGet extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to get",
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
    const spaceName = args.space_name;

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
      const response = await rest.request(
        "get",
        `/channels/${encodeURIComponent(channelName)}/presence`,
        2,
        {},
        null,
      );

      if (response.statusCode !== 200) {
        this.fail(
          `Failed to fetch space: ${response.statusCode}`,
          flags,
          "spaceGet",
        );
      }

      const items: PresenceItem[] = response.items || [];

      if (items.length === 0) {
        this.fail(
          `Space ${spaceName} doesn't have any members currently present. Spaces only exist while members are present. Please enter at least one member using "ably spaces members enter".`,
          flags,
          "spaceGet",
          { spaceName },
        );
      }

      const members: MemberInfo[] = items.map((item) => ({
        clientId: item.clientId,
        connectionId: item.connectionId,
        isConnected: item.action !== "leave" && item.action !== "absent",
        profileData: item.data?.profileUpdate?.current ?? null,
        location: item.data?.locationUpdate?.current ?? null,
        lastEvent: { name: item.action, timestamp: item.timestamp },
      }));

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
        this.log(`\n${formatHeading("Space")} ${formatResource(spaceName)}\n`);
        this.log(
          `${formatHeading("Members")} (${formatCountLabel(members.length, "member")}):\n`,
        );

        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          this.log(`${formatIndex(i + 1)}`);
          this.log(
            `  ${formatLabel("Client ID")} ${formatClientId(member.clientId)}`,
          );
          this.log(`  ${formatLabel("Connection ID")} ${member.connectionId}`);
          this.log(`  ${formatLabel("Connected")} ${member.isConnected}`);
          if (
            member.profileData &&
            Object.keys(member.profileData).length > 0
          ) {
            this.log(
              `  ${formatLabel("Profile")} ${JSON.stringify(member.profileData)}`,
            );
          }

          if (member.location != null) {
            this.log(
              `  ${formatLabel("Location")} ${JSON.stringify(member.location)}`,
            );
          }

          this.log(
            `  ${formatLabel("Last Event")} ${formatEventType(member.lastEvent.name)}`,
          );
          this.log(
            `  ${formatLabel("Event Timestamp")} ${formatMessageTimestamp(member.lastEvent.timestamp)}`,
          );
          this.log("");
        }
      }
    } catch (error) {
      this.fail(error, flags, "spaceGet", { spaceName });
    }
  }
}
