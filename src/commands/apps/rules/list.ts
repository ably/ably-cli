import { Flags } from "@oclif/core";
import type { Namespace } from "../../../services/control-api.js";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import {
  formatCountLabel,
  formatHeading,
  formatLimitWarning,
} from "../../../utils/output.js";

interface ChannelRuleOutput {
  authenticated: boolean;
  batchingEnabled: boolean;
  batchingInterval: null | number;
  conflationEnabled: boolean;
  conflationInterval: null | number;
  conflationKey: null | string;
  created: string;
  id: string;
  modified: string;
  mutableMessages: boolean;
  persistLast: boolean;
  persisted: boolean;
  populateChannelRegistry: boolean;
  pushEnabled: boolean;
  tlsOnly: boolean;
}

export default class RulesListCommand extends ControlBaseCommand {
  static description = "List rules for an app";

  static examples = [
    "$ ably apps rules list",
    "$ ably apps rules list --app my-app-id",
    "$ ably apps rules list --json",
    "$ ably apps rules list --pretty-json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return",
      min: 1,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RulesListCommand);
    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const allNamespaces = await controlApi.listNamespaces(appId);
      const hasMore = allNamespaces.length > flags.limit;
      const namespaces = allNamespaces.slice(0, flags.limit);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            appId,
            hasMore,
            rules: namespaces.map(
              (rule: Namespace): ChannelRuleOutput => ({
                authenticated: rule.authenticated || false,
                batchingEnabled: rule.batchingEnabled || false,
                // Control API may omit optional fields; emit null for consistent JSON schema
                batchingInterval: rule.batchingInterval ?? null,
                conflationEnabled: rule.conflationEnabled || false,
                conflationInterval: rule.conflationInterval ?? null,
                conflationKey: rule.conflationKey ?? null,
                created: new Date(rule.created).toISOString(),
                id: rule.id,
                modified: new Date(rule.modified).toISOString(),
                mutableMessages: rule.mutableMessages || false,
                persistLast: rule.persistLast || false,
                persisted: rule.persisted || false,
                populateChannelRegistry: rule.populateChannelRegistry || false,
                pushEnabled: rule.pushEnabled || false,
                tlsOnly: rule.tlsOnly || false,
              }),
            ),
            timestamp: new Date().toISOString(),
            total: namespaces.length,
          },
          flags,
        );
      } else {
        if (namespaces.length === 0) {
          this.log("No rules found");
          return;
        }

        this.log(`Found ${formatCountLabel(namespaces.length, "rule")}:\n`);

        namespaces.forEach((namespace: Namespace) => {
          this.log(formatHeading(`ID: ${namespace.id}`));
          for (const line of formatChannelRuleDetails(namespace, {
            bold: true,
            formatDate: (t) => this.formatDate(t),
            indent: "  ",
            showTimestamps: true,
          })) {
            this.log(line);
          }

          this.log(""); // Add a blank line between rules
        });

        if (hasMore) {
          const warning = formatLimitWarning(
            namespaces.length,
            flags.limit,
            "rules",
          );
          if (warning) this.logToStderr(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "ruleList", { appId });
    }
  }
}
