import { StatsBaseCommand } from "../../stats-base-command.js";
import type { StatsDisplayData } from "../../services/stats-display.js";
import type { BaseFlags } from "../../types/cli.js";
import type { ControlApi } from "../../services/control-api.js";
import { formatResource } from "../../utils/output.js";

export default class StatsAccountCommand extends StatsBaseCommand {
  static description = "Get account stats with optional live updates";

  static examples = [
    "$ ably stats account",
    "$ ably stats account --unit hour",
    '$ ably stats account --start "2023-01-01T00:00:00Z" --end "2023-01-02T00:00:00Z"',
    "$ ably stats account --start 1h",
    "$ ably stats account --limit 10",
    "$ ably stats account --json",
    "$ ably stats account --pretty-json",
    "$ ably stats account --live",
    "$ ably stats account --live --interval 15",
  ];

  static flags = { ...StatsBaseCommand.statsFlags };

  private accountLabel: string = "";

  protected async fetchStats(
    controlApi: ControlApi,
    params: { end: number; limit: number; start: number; unit: string },
  ): Promise<StatsDisplayData[]> {
    return controlApi.getAccountStats(params);
  }

  protected getStatsDisplayOptions(): Record<string, unknown> {
    return { isAccountStats: true };
  }

  protected async getStatsLabel(
    _flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<string> {
    if (!this.accountLabel) {
      const { account } = await controlApi.getMe();
      this.accountLabel = `account ${formatResource(account.name)} (${account.id})`;
    }

    return this.accountLabel;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(StatsAccountCommand);
    try {
      const controlApi = this.createControlApi(flags);
      await this.runStats(flags, controlApi);
    } catch (error) {
      this.fail(error, flags, "StatsAccount");
    }
  }
}
