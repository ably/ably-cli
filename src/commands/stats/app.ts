import { Args } from "@oclif/core";

import { StatsBaseCommand } from "../../stats-base-command.js";
import type { StatsDisplayData } from "../../services/stats-display.js";
import type { ControlApi } from "../../services/control-api.js";
import { formatResource } from "../../utils/output.js";

export default class StatsAppCommand extends StatsBaseCommand {
  static args = {
    id: Args.string({
      description: "App ID to get stats for (uses default app if not provided)",
      required: false,
    }),
  };

  static description = "Get app stats with optional live updates";

  static examples = [
    "$ ably stats app",
    "$ ably stats app app-id",
    "$ ably stats app --unit hour",
    "$ ably stats app app-id --unit hour",
    '$ ably stats app app-id --start "2023-01-01T00:00:00Z" --end "2023-01-02T00:00:00Z"',
    "$ ably stats app app-id --start 1h",
    "$ ably stats app app-id --limit 10",
    "$ ably stats app app-id --json",
    "$ ably stats app app-id --pretty-json",
    "$ ably stats app --live",
    "$ ably stats app app-id --live",
    "$ ably stats app --live --interval 15",
  ];

  static flags = { ...StatsBaseCommand.statsFlags };

  private appId: string = "";

  protected async fetchStats(
    controlApi: ControlApi,
    params: { end: number; limit: number; start: number; unit: string },
  ): Promise<StatsDisplayData[]> {
    return controlApi.getAppStats(this.appId, params);
  }

  protected async getStatsLabel(): Promise<string> {
    return `app ${formatResource(this.appId)}`;
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(StatsAppCommand);

    this.appId = args.id || this.configManager.getCurrentAppId() || "";
    if (!this.appId) {
      this.fail(
        'No app ID provided and no default app selected. Please specify an app ID or select a default app with "ably apps switch".',
        flags,
        "StatsApp",
      );
    }

    try {
      const controlApi = this.createControlApi(flags);
      await this.runStats(flags, controlApi);
    } catch (error) {
      this.fail(error, flags, "StatsApp");
    }
  }
}
