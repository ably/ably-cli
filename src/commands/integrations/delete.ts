import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { errorMessage } from "../../utils/errors.js";
import { resource, success } from "../../utils/output.js";
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
    if (!appId) return;

    const controlApi = this.createControlApi(flags);

    try {
      // Get integration details for confirmation
      const integration = await controlApi.getRule(appId, args.integrationId);

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error:
              "The --force flag is required when using --json to confirm deletion",
            success: false,
          },
          flags,
        );
        return;
      }

      // If not using force flag, prompt for confirmation
      if (!flags.force && !this.shouldOutputJson(flags)) {
        this.log(`\nYou are about to delete the following integration:`);
        this.log(`Integration ID: ${integration.id}`);
        this.log(`Type: ${integration.ruleType}`);
        this.log(`Request Mode: ${integration.requestMode}`);
        this.log(`Source Type: ${integration.source.type}`);
        this.log(
          `Channel Filter: ${integration.source.channelFilter || "(none)"}`,
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
        this.log(
          this.formatJsonOutput(
            {
              integration: {
                appId: integration.appId,
                id: integration.id,
                ruleType: integration.ruleType,
                sourceType: integration.source.type,
              },
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          success(`Integration rule deleted: ${resource(integration.id)}.`),
        );
        this.log(`ID: ${integration.id}`);
        this.log(`App ID: ${integration.appId}`);
        this.log(`Type: ${integration.ruleType}`);
        this.log(`Source Type: ${integration.source.type}`);
      }
    } catch (error) {
      const errorMsg = `Error deleting integration: ${errorMessage(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
