import { Flags } from "@oclif/core";
import { ControlBaseCommand } from "../../control-base-command.js";
import { formatHeading, formatLimitWarning } from "../../utils/output.js";

export default class IntegrationsListCommand extends ControlBaseCommand {
  static description = "List all integrations";

  static examples = [
    "$ ably integrations list",
    '$ ably integrations list --app "My App" --json',
    '$ ably integrations list --app "My App" --pretty-json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,

    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return (default: 100)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(IntegrationsListCommand);

    // Display authentication information
    this.showAuthInfoIfNeeded(flags);

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const allIntegrations = await controlApi.listRules(appId);
      const hasMore = allIntegrations.length > flags.limit;
      const integrations = allIntegrations.slice(0, flags.limit);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            appId,
            hasMore,
            integrations: integrations.map((integration) => ({
              appId: integration.appId,
              created: new Date(integration.created).toISOString(),
              id: integration.id,
              modified: new Date(integration.modified).toISOString(),
              requestMode: integration.requestMode,
              source: {
                channelFilter: integration.source.channelFilter || null,
                type: integration.source.type,
              },
              target: integration.target,
              type: integration.ruleType,
              version: integration.version,
            })),
            timestamp: new Date().toISOString(),
            total: integrations.length,
          },
          flags,
        );
      } else {
        if (integrations.length === 0) {
          this.log("No integrations found");
          return;
        }

        this.log(`Found ${integrations.length} integrations:\n`);

        for (const integration of integrations) {
          this.log(formatHeading(`Integration ID: ${integration.id}`));
          this.log(`  App ID: ${integration.appId}`);
          this.log(`  Type: ${integration.ruleType}`);
          this.log(`  Request Mode: ${integration.requestMode}`);
          this.log(`  Source Type: ${integration.source.type}`);
          this.log(
            `  Channel Filter: ${integration.source.channelFilter || "(none)"}`,
          );
          this.log(
            `  Target: ${JSON.stringify(integration.target, null, 2).replaceAll("\n", "\n    ")}`,
          );
          this.log(`  Version: ${integration.version}`);
          this.log(`  Created: ${this.formatDate(integration.created)}`);
          this.log(`  Updated: ${this.formatDate(integration.modified)}`);
          this.log(""); // Add a blank line between integrations
        }

        if (hasMore) {
          const warning = formatLimitWarning(
            integrations.length,
            flags.limit,
            "integrations",
          );
          if (warning) this.log(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "integrationList");
    }
  }
}
