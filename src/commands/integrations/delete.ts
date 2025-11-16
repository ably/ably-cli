import { Args, Flags } from "@oclif/core";
import * as readline from "node:readline";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";

export default class IntegrationsDeleteCommand extends ControlBaseCommand {
  static args = {
    integrationId: Args.string({
      description: "The integration ID to delete",
      required: true,
    }),
  };

  static description = "Delete an integration";

  static examples = [
    "$ ably integrations delete integration123",
    '$ ably integrations delete integration123 --app "My App"',
    "$ ably integrations delete integration123 --force",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to delete the integration from",
      required: false,
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Force deletion without confirmation",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(IntegrationsDeleteCommand);

    const controlApi = this.createControlApi(flags);

    try {
      // Get app ID from flags or config
      const appId = await this.resolveAppId(flags);

      if (!appId) {
        this.error(
          'No app specified. Use --app flag or select an app with "ably apps switch"',
        );
        return;
      }

      // Get integration details for confirmation
      const integration = await controlApi.getRule(appId, args.integrationId);

      // If not using force flag, prompt for confirmation
      if (!flags.force) {
        this.log(`\nYou are about to delete the following integration:`);
        this.log(`Integration ID: ${integration.id}`);
        this.log(`Type: ${integration.ruleType}`);
        this.log(`Request Mode: ${integration.requestMode}`);
        this.log(`Source Type: ${integration.source.type}`);
        this.log(`Channel Filter: ${integration.source.channelFilter || "(none)"}`);

        const confirmed = await this.promptForConfirmation(
          `\nAre you sure you want to delete integration "${integration.id}"? [y/N]`,
        );

        if (!confirmed) {
          this.log("Deletion cancelled");
          return;
        }
      }

      await controlApi.deleteRule(appId, args.integrationId);

      this.log(chalk.green("✓ Integration deleted successfully!"));
      this.log(`ID: ${integration.id}`);
      this.log(`App ID: ${integration.appId}`);
      this.log(`Type: ${integration.ruleType}`);
      this.log(`Source Type: ${integration.source.type}`);
    } catch (error) {
      this.error(
        `Error deleting integration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async promptForConfirmation(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        rl.close();
        const response = answer.toLowerCase().trim();
        resolve(response === "y" || response === "yes");
      });
    });
  }
}
