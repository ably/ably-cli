import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { forceFlag } from "../../../flags.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { formatLabel, formatResource } from "../../../utils/output.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class RulesDeleteCommand extends ControlBaseCommand {
  static args = {
    nameOrId: Args.string({
      description: "Name or ID of the rule to delete",
      required: true,
    }),
  };

  static description = "Delete a rule";

  static examples = [
    "$ ably apps rules delete chat",
    '$ ably apps rules delete events --app "My App"',
    "$ ably apps rules delete notifications --force",
    "$ ably apps rules delete chat --json",
    "$ ably apps rules delete chat --pretty-json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RulesDeleteCommand);

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      // Find the namespace by name or ID
      const namespaces = await controlApi.listNamespaces(appId);
      const namespace = namespaces.find((n) => n.id === args.nameOrId);

      if (!namespace) {
        this.fail(`Rule "${args.nameOrId}" not found`, flags, "ruleDelete", {
          appId,
        });
      }

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm deletion",
          flags,
          "ruleDelete",
        );
      }

      // If not using force flag, prompt for confirmation
      if (!flags.force && !this.shouldOutputJson(flags)) {
        this.log(`\nYou are about to delete the following rule:`);
        this.log(`${formatLabel("ID")} ${formatResource(namespace.id)}`);
        for (const line of formatChannelRuleDetails(namespace, {
          bold: true,
          formatDate: (t) => this.formatDate(t),
          showTimestamps: true,
        })) {
          this.log(line);
        }

        const confirmed = await promptForConfirmation(
          `\nAre you sure you want to delete rule with ID "${namespace.id}"?`,
        );

        if (!confirmed) {
          // This branch is only reachable when !shouldOutputJson (see outer condition),
          // so only human-readable output is needed here.
          this.logWarning("Deletion cancelled.", flags);
          return;
        }
      }

      await controlApi.deleteNamespace(appId, namespace.id);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            appId,
            rule: {
              id: namespace.id,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      }

      this.logSuccessMessage(
        `Channel rule ${formatResource(namespace.id)} deleted.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "ruleDelete", { appId });
    }
  }
}
