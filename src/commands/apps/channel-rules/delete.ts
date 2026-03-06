import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { errorMessage } from "../../../utils/errors.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class ChannelRulesDeleteCommand extends ControlBaseCommand {
  static args = {
    nameOrId: Args.string({
      description: "Name or ID of the channel rule to delete",
      required: true,
    }),
  };

  static description = "Delete a channel rule";

  static examples = [
    "$ ably apps channel-rules delete chat",
    '$ ably apps channel-rules delete events --app "My App"',
    "$ ably apps channel-rules delete notifications --force",
    "$ ably apps channel-rules delete chat --json",
    "$ ably apps channel-rules delete chat --pretty-json",
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
    const { args, flags } = await this.parse(ChannelRulesDeleteCommand);

    const appId = await this.requireAppId(flags);
    if (!appId) return;

    const controlApi = this.createControlApi(flags);

    try {
      // Find the namespace by name or ID
      const namespaces = await controlApi.listNamespaces(appId);
      const namespace = namespaces.find((n) => n.id === args.nameOrId);

      if (!namespace) {
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            {
              appId,
              error: `Channel rule "${args.nameOrId}" not found`,
              status: "error",
              success: false,
            },
            flags,
          );
        } else {
          this.error(`Channel rule "${args.nameOrId}" not found`);
        }

        return;
      }

      // If not using force flag or JSON mode, prompt for confirmation
      if (!flags.force && !this.shouldOutputJson(flags)) {
        this.log(`\nYou are about to delete the following channel rule:`);
        this.log(`ID: ${namespace.id}`);
        for (const line of formatChannelRuleDetails(namespace, {
          formatDate: (t) => this.formatDate(t),
          showTimestamps: true,
        })) {
          this.log(line);
        }

        const confirmed = await promptForConfirmation(
          `\nAre you sure you want to delete channel rule with ID "${namespace.id}"?`,
        );

        if (!confirmed) {
          if (this.shouldOutputJson(flags)) {
            this.jsonError(
              {
                appId,
                error: "Deletion cancelled by user",
                ruleId: namespace.id,
                status: "cancelled",
                success: false,
              },
              flags,
            );
          } else {
            this.log("Deletion cancelled");
          }

          return;
        }
      }

      await controlApi.deleteNamespace(appId, namespace.id);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              appId,
              rule: {
                id: namespace.id,
              },
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(`Channel rule with ID "${namespace.id}" deleted successfully`);
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            appId,
            error: errorMessage(error),
            status: "error",
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error deleting channel rule: ${errorMessage(error)}`);
      }
    }
  }
}
