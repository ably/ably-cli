import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { formatResource, formatSuccess } from "../../../utils/output.js";
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

    try {
      const controlApi = this.createControlApi(flags);
      // Find the namespace by name or ID
      const namespaces = await controlApi.listNamespaces(appId);
      const namespace = namespaces.find((n) => n.id === args.nameOrId);

      if (!namespace) {
        this.fail(
          `Channel rule "${args.nameOrId}" not found`,
          flags,
          "channelRuleDelete",
          { appId },
        );
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
          // This branch is only reachable when !shouldOutputJson (see outer condition),
          // so only human-readable output is needed here.
          this.log("Deletion cancelled");
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
      } else {
        this.log(
          formatSuccess(
            `Channel rule ${formatResource(namespace.id)} deleted.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags, "channelRuleDelete", { appId });
    }
  }
}
