import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import {
  formatLabel,
  formatResource,
  formatSuccess,
} from "../../utils/output.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

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
      description: "The app ID or name (defaults to current app)",
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

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      // Get integration details for confirmation
      const integration = await controlApi.getRule(appId, args.integrationId);

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          new Error(
            "The --force flag is required when using --json to confirm deletion",
          ),
          flags,
          "IntegrationDelete",
        );
      }

      // If not using force flag, prompt for confirmation
      if (!flags.force && !this.shouldOutputJson(flags)) {
        this.log(`\nYou are about to delete the following integration:`);
        this.log(`${formatLabel("Integration ID")} ${integration.id}`);
        this.log(`${formatLabel("Type")} ${integration.ruleType}`);
        this.log(`${formatLabel("Request Mode")} ${integration.requestMode}`);
        this.log(`${formatLabel("Source Type")} ${integration.source.type}`);
        this.log(
          `${formatLabel("Channel Filter")} ${integration.source.channelFilter || "(none)"}`,
        );

        const confirmed = await promptForConfirmation(
          `\nAre you sure you want to delete integration "${integration.id}"?`,
        );

        if (!confirmed) {
          this.log("Deletion cancelled");
          return;
        }
      }

      await controlApi.deleteRule(appId, args.integrationId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            integration: {
              appId: integration.appId,
              id: integration.id,
              ruleType: integration.ruleType,
              sourceType: integration.source.type,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Integration rule deleted: ${formatResource(integration.id)}.`,
          ),
        );
        this.log(`${formatLabel("ID")} ${integration.id}`);
        this.log(`${formatLabel("App ID")} ${integration.appId}`);
        this.log(`${formatLabel("Type")} ${integration.ruleType}`);
        this.log(`${formatLabel("Source Type")} ${integration.source.type}`);
      }
    } catch (error) {
      this.fail(error, flags, "IntegrationDelete");
    }
  }
}
