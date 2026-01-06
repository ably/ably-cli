import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import chalk from "chalk";

export default class PushChannelsRemoveWhere extends AblyBaseCommand {
  static override description =
    "Remove push channel subscriptions matching filter criteria (maps to push.admin.channelSubscriptions.removeWhere)";

  static override examples = [
    // Remove all subscriptions for a device on a channel
    "$ ably push channels remove-where --channel alerts --device-id my-device-123 --force",
    // Remove all subscriptions for a client on a channel
    "$ ably push channels remove-where --channel alerts --client-id user-456 --force",
    // JSON output
    "$ ably push channels remove-where --channel alerts --device-id my-device-123 --json --force",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    channel: Flags.string({
      description: "Channel to remove subscriptions from",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    "client-id": Flags.string({
      description: "Filter by client ID",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsRemoveWhere);

    // Validate that at least one filter is provided
    if (!flags["device-id"] && !flags["client-id"]) {
      this.error(
        "At least one filter criterion (--device-id or --client-id) is required to prevent accidentally removing all subscriptions",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build filter description for confirmation
      const filters: string[] = [`channel=${flags.channel}`];
      if (flags["device-id"]) filters.push(`deviceId=${flags["device-id"]}`);
      if (flags["client-id"]) filters.push(`clientId=${flags["client-id"]}`);
      const filterDescription = filters.join(", ");

      // Confirm deletion unless --force is used
      if (!flags.force && !this.shouldOutputJson(flags)) {
        const { default: inquirer } = await import("inquirer");
        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to remove all subscriptions matching: ${chalk.cyan(filterDescription)}?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      // Build params for removeWhere
      const params: Record<string, string> = {
        channel: flags.channel,
      };

      if (flags["device-id"]) {
        params.deviceId = flags["device-id"];
      }

      if (flags["client-id"]) {
        params.clientId = flags["client-id"];
      }

      // Remove matching subscriptions
      await rest.push.admin.channelSubscriptions.removeWhere(params);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              channel: flags.channel,
              deviceId: flags["device-id"],
              clientId: flags["client-id"],
              removed: true,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          chalk.green(
            `Subscriptions removed successfully matching: ${filterDescription}`,
          ),
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: number }).code;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error: errorMessage,
              code: errorCode,
              success: false,
            },
            flags,
          ),
        );
        this.exit(1);
      } else {
        this.error(`Error removing subscriptions: ${errorMessage}`);
      }
    }
  }
}
