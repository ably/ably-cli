import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import { progress, resource, success } from "../../../utils/output.js";

interface LocationData {
  [key: string]: unknown;
}

interface Member {
  clientId?: string;
  memberId?: string;
  isCurrentMember?: boolean;
}

interface LocationWithCurrent {
  current: {
    member: Member;
  };
  location?: LocationData;
  data?: LocationData;
  [key: string]: unknown;
}

interface LocationItem {
  [key: string]: unknown;
  clientId?: string;
  connectionId?: string;
  data?: LocationData;
  id?: string;
  location?: LocationData;
  member?: Member;
  memberId?: string;
  userId?: string;
}

export default class SpacesLocationsGetAll extends SpacesBaseCommand {
  static override args = {
    space: Args.string({
      description: "Space to get locations from",
      required: true,
    }),
  };

  static override description = "Get all current locations in a space";

  static override examples = [
    "$ ably spaces locations get-all my-space",
    "$ ably spaces locations get-all my-space --json",
    "$ ably spaces locations get-all my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesLocationsGetAll);
    this.parsedFlags = flags;
    const { space: spaceName } = args;

    try {
      const setupResult = await this.setupSpacesClient(flags, spaceName);
      this.realtimeClient = setupResult.realtimeClient;
      this.space = setupResult.space;
      if (!this.realtimeClient || !this.space) {
        this.error("Failed to initialize clients or space");
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const checkConnection = () => {
          const { state } = this.realtimeClient!.connection;
          if (state === "connected") {
            resolve();
          } else if (
            state === "failed" ||
            state === "closed" ||
            state === "suspended"
          ) {
            reject(new Error(`Connection failed with state: ${state}`));
          } else {
            setTimeout(checkConnection, 100);
          }
        };

        checkConnection();
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(progress(`Connecting to space: ${resource(spaceName)}`));
      }

      await this.space.enter();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for space connection"));
        }, 5000);

        const checkSpaceStatus = () => {
          try {
            if (this.realtimeClient!.connection.state === "connected") {
              clearTimeout(timeout);
              if (!this.shouldOutputJson(flags)) {
                this.log(
                  success(`Connected to space: ${resource(spaceName)}.`),
                );
              }

              resolve();
            } else if (
              this.realtimeClient!.connection.state === "failed" ||
              this.realtimeClient!.connection.state === "closed" ||
              this.realtimeClient!.connection.state === "suspended"
            ) {
              clearTimeout(timeout);
              reject(
                new Error(
                  `Space connection failed with connection state: ${this.realtimeClient!.connection.state}`,
                ),
              );
            } else {
              setTimeout(checkSpaceStatus, 100);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        checkSpaceStatus();
      });

      if (!this.shouldOutputJson(flags)) {
        this.log(
          progress(`Fetching locations for space ${resource(spaceName)}`),
        );
      }

      let locations: LocationItem[] = [];
      try {
        const { items: locationsFromSpace } =
          await this.space.locations.getAll();

        if (locationsFromSpace && typeof locationsFromSpace === "object") {
          if (Array.isArray(locationsFromSpace)) {
            locations = locationsFromSpace as LocationItem[];
          } else if (Object.keys(locationsFromSpace).length > 0) {
            locations = Object.entries(locationsFromSpace).map(
              ([memberId, locationData]) => ({
                location: locationData,
                memberId,
              }),
            ) as LocationItem[];
          }
        }

        const knownMetaKeys = new Set([
          "clientId",
          "connectionId",
          "current",
          "id",
          "member",
          "memberId",
          "userId",
        ]);

        const extractLocationData = (item: LocationItem): unknown => {
          if (item.location !== undefined) return item.location;
          if (item.data !== undefined) return item.data;
          const rest: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(item)) {
            if (!knownMetaKeys.has(key)) {
              rest[key] = value;
            }
          }
          return Object.keys(rest).length > 0 ? rest : null;
        };

        const validLocations = locations.filter((item: LocationItem) => {
          if (item === null || item === undefined) return false;

          const locationData = extractLocationData(item);

          if (locationData === null || locationData === undefined) return false;
          if (
            typeof locationData === "object" &&
            Object.keys(locationData as object).length === 0
          )
            return false;

          return true;
        });

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                locations: validLocations.map((item: LocationItem) => {
                  const currentMember =
                    "current" in item &&
                    item.current &&
                    typeof item.current === "object"
                      ? (item.current as LocationWithCurrent["current"]).member
                      : undefined;
                  const member = item.member || currentMember;
                  const memberId =
                    item.memberId ||
                    member?.memberId ||
                    member?.clientId ||
                    item.clientId ||
                    item.id ||
                    item.userId ||
                    "Unknown";
                  const locationData = extractLocationData(item);
                  return {
                    isCurrentMember: member?.isCurrentMember || false,
                    location: locationData,
                    memberId,
                  };
                }),
                spaceName,
                success: true,
                timestamp: new Date().toISOString(),
              },
              flags,
            ),
          );
        } else if (!validLocations || validLocations.length === 0) {
          this.log(
            chalk.yellow("No locations are currently set in this space."),
          );
        } else {
          const locationsCount = validLocations.length;
          this.log(
            `\n${chalk.cyan("Current locations")} (${chalk.bold(String(locationsCount))}):\n`,
          );

          for (const location of validLocations) {
            // Check if location has 'current' property with expected structure
            if (
              "current" in location &&
              typeof location.current === "object" &&
              location.current !== null &&
              "member" in location.current
            ) {
              const locationWithCurrent = location as LocationWithCurrent;
              const { member } = locationWithCurrent.current;
              this.log(
                `Member ID: ${chalk.cyan(member.memberId || member.clientId)}`,
              );
              try {
                const locationData = extractLocationData(location);

                this.log(
                  `- ${chalk.blue(member.memberId || member.clientId)}:`,
                );
                this.log(
                  `  ${chalk.dim("Location:")} ${JSON.stringify(locationData, null, 2)}`,
                );

                if (member.isCurrentMember) {
                  this.log(`  ${chalk.green("(Current member)")}`);
                }
              } catch (error) {
                this.log(
                  `- ${chalk.red("Error displaying location item")}: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            } else {
              // Simpler display if location doesn't have expected structure
              this.log(`- ${chalk.blue("Member")}:`);
              this.log(
                `  ${chalk.dim("Location:")} ${JSON.stringify(location, null, 2)}`,
              );
            }
          }
        }
      } catch (error) {
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            {
              error: error instanceof Error ? error.message : String(error),
              spaceName,
              status: "error",
              success: false,
            },
            flags,
          );
        } else {
          this.error(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error || "Unknown error");
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { error: errorMessage, spaceName, status: "error", success: false },
          flags,
        );
      } else {
        this.error(`Error: ${errorMessage}`);
      }
    }
  }
}
