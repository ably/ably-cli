import { Flags } from "@oclif/core";
import type { Namespace } from "../../../services/control-api.js";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { formatHeading } from "../../../utils/output.js";

interface ChannelRuleOutput {
  authenticated: boolean;
  batchingEnabled: boolean;
  batchingInterval: null | number;
  conflationEnabled: boolean;
  conflationInterval: null | number;
  conflationKey: null | string;
  created: string;
  exposeTimeSerial: boolean;
  id: string;
  modified: string;
  persistLast: boolean;
  persisted: boolean;
  populateChannelRegistry: boolean;
  pushEnabled: boolean;
  tlsOnly: boolean;
}

export default class ChannelRulesListCommand extends ControlBaseCommand {
  static description = "List channel rules for an app";

  static examples = [
    "$ ably apps:channel-rules:list",
    "$ ably apps:channel-rules:list --app my-app-id",
    "$ ably apps:channel-rules:list --json",
    "$ ably apps:channel-rules:list --pretty-json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ChannelRulesListCommand);
    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const namespaces = await controlApi.listNamespaces(appId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            appId,
            rules: namespaces.map(
              (rule: Namespace): ChannelRuleOutput => ({
                authenticated: rule.authenticated || false,
                batchingEnabled: rule.batchingEnabled || false,
                batchingInterval: rule.batchingInterval || null,
                conflationEnabled: rule.conflationEnabled || false,
                conflationInterval: rule.conflationInterval || null,
                conflationKey: rule.conflationKey || null,
                created: new Date(rule.created).toISOString(),
                exposeTimeSerial: rule.exposeTimeSerial || false,
                id: rule.id,
                modified: new Date(rule.modified).toISOString(),
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
          this.log("No channel rules found");
          return;
        }

        this.log(`Found ${namespaces.length} channel rules:\n`);

        namespaces.forEach((namespace: Namespace) => {
          this.log(formatHeading(`Channel Rule ID: ${namespace.id}`));
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
      }
    } catch (error) {
      this.fail(error, flags, "channelRuleList", { appId });
    }
  }
}
