import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatHeading, formatLabel } from "../../utils/output.js";

export default class IntegrationsGetCommand extends ControlBaseCommand {
  static args = {
    ruleId: Args.string({
      description: "The rule ID to get",
      required: true,
    }),
  };

  static description = "Get an integration rule by ID";

  static examples = [
    "$ ably integrations get rule123",
    "$ ably integrations get rule123 --json",
    '$ ably integrations get rule123 --app "My App" --pretty-json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,

    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(IntegrationsGetCommand);

    // Display authentication information
    this.showAuthInfoIfNeeded(flags);

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const rule = await controlApi.getRule(appId, args.ruleId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            rule: structuredClone(rule) as unknown as Record<string, unknown>,
          },
          flags,
        );
      } else {
        this.log(formatHeading("Integration Rule Details"));
        this.log(`${formatLabel("ID")} ${rule.id}`);
        this.log(`${formatLabel("App ID")} ${rule.appId}`);
        this.log(`${formatLabel("Rule Type")} ${rule.ruleType}`);
        this.log(`${formatLabel("Request Mode")} ${rule.requestMode}`);
        if (rule.source.channelFilter) {
          this.log(
            `${formatLabel("Source Channel Filter")} ${rule.source.channelFilter}`,
          );
        }
        this.log(`${formatLabel("Source Type")} ${rule.source.type}`);
        this.log(
          `${formatLabel("Target")} ${this.formatJsonOutput(structuredClone(rule.target) as unknown as Record<string, unknown>, flags).replaceAll("\n", "\n  ")}`,
        );
        this.log(`${formatLabel("Version")} ${rule.version}`);
        this.log(`${formatLabel("Created")} ${this.formatDate(rule.created)}`);
        this.log(`${formatLabel("Updated")} ${this.formatDate(rule.modified)}`);
      }
    } catch (error) {
      this.fail(error, flags, "integrationGet");
    }
  }
}
