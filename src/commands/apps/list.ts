import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatLimitWarning } from "../../utils/output.js";

export default class AppsList extends ControlBaseCommand {
  static override description = "List all apps in the current account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return",
      min: 1,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AppsList);

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const allApps = await controlApi.listApps();
        const hasMore = allApps.length > flags.limit;
        const apps = allApps.slice(0, flags.limit);

        // Get current app ID from config
        const currentAppId = this.configManager.getCurrentAppId();

        if (this.shouldOutputJson(flags)) {
          // Mark current app in JSON output
          const appsWithCurrentFlag = apps.map((app) => ({
            ...app,
            created: new Date(app.created).toISOString(),
            modified: new Date(app.modified).toISOString(),
            isCurrent: app.id === currentAppId,
          }));

          this.logJsonResult({ apps: appsWithCurrentFlag, hasMore }, flags);
          return;
        }

        if (apps.length === 0) {
          this.log("No apps found in this account.");
          return;
        }

        this.log(`Found ${apps.length} apps:\n`);

        // Sort apps so current app is first, then alphabetically by name
        const sortedApps = [...apps].sort((a, b) => {
          // Current app first
          if (a.id === currentAppId) return -1;
          if (b.id === currentAppId) return 1;

          // Then alphabetically by name
          return (a.name || "").localeCompare(b.name || "");
        });

        for (const app of sortedApps) {
          const isCurrent = app.id === currentAppId;
          const prefix = isCurrent ? chalk.green("▶ ") : "  ";
          const nameStyle = isCurrent ? chalk.green.bold : chalk.white;

          this.log(
            `${prefix}App ID: ${nameStyle(app.id)}${isCurrent ? " (current)" : ""}`,
          );
          this.log(`  Name: ${app.name || "Unnamed App"}`);
          this.log(`  Status: ${app.status}`);
          this.log(`  Account ID: ${app.accountId}`);
          this.log(`  TLS Only: ${app.tlsOnly ? "Yes" : "No"}`);

          if (app.created) {
            this.log(`  Created: ${this.formatDate(app.created)}`);
          }

          if (app.modified) {
            this.log(`  Updated: ${this.formatDate(app.modified)}`);
          }

          this.log(""); // Add a blank line between apps
        }

        if (hasMore) {
          const warning = formatLimitWarning(apps.length, flags.limit, "apps");
          if (warning) this.log(warning);
        }
      },
      "Error listing apps",
    );
  }
}
