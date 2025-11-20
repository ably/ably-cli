import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";

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
      description: "App ID or name to list integrations for",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(IntegrationsListCommand);

    // Display authentication information
    this.showAuthInfoIfNeeded(flags);

    const controlApi = this.createControlApi(flags);
    let appId: string | undefined;

    try {
      // Get app ID from flags or config
      appId = await this.resolveAppId(flags);

      if (!appId) {
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            {
              error:
                'No app specified. Use --app flag or select an app with "ably apps switch"',
              status: "error",
              success: false,
            },
            flags,
          );
          return;
        } else {
          this.error(
            'No app specified. Use --app flag or select an app with "ably apps switch"',
          );
        }

        return;
      }

      const integrations = await controlApi.listRules(appId);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              appId,
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
              success: true,
              timestamp: new Date().toISOString(),
              total: integrations.length,
            },
            flags,
          ),
        );
      } else {
        if (integrations.length === 0) {
          this.log("No integrations found");
          return;
        }

        this.log(`Found ${integrations.length} integrations:\n`);

        for (const integration of integrations) {
          this.log(chalk.bold(`Integration ID: ${integration.id}`));
          this.log(`  App ID: ${integration.appId}`);
          this.log(`  Type: ${integration.ruleType}`);
          this.log(`  Request Mode: ${integration.requestMode}`);
          this.log(`  Source Type: ${integration.source.type}`);
          this.log(
            `  Channel Filter: ${integration.source.channelFilter || "(none)"}`,
          );
          this.log(
            `  Target: ${this.formatJsonOutput(integration.target as Record<string, unknown>, flags).replaceAll("\n", "\n    ")}`,
          );
          this.log(`  Version: ${integration.version}`);
          this.log(`  Created: ${this.formatDate(integration.created)}`);
          this.log(`  Updated: ${this.formatDate(integration.modified)}`);
          this.log(""); // Add a blank line between integrations
        }
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            appId,
            error: error instanceof Error ? error.message : String(error),
            status: "error",
            success: false,
          },
          flags,
        );
        return;
      } else {
        this.error(
          `Error listing integrations: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
