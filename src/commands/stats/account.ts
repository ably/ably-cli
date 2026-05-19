import { Args } from "@oclif/core";

import { StatsBaseCommand } from "../../stats-base-command.js";
import type { StatsDisplayData } from "../../services/stats-display.js";
import type { BaseFlags } from "../../types/cli.js";
import { ControlApi } from "../../services/control-api.js";
import { formatResource } from "../../utils/output.js";

export default class StatsAccountCommand extends StatsBaseCommand {
  static args = {
    accountAliasOrId: Args.string({
      description:
        "Account alias or ID to get stats for (uses current account if not provided)",
      required: false,
    }),
  };

  static description = "Get account stats with optional live updates";

  static examples = [
    "$ ably stats account",
    "$ ably stats account mycompany",
    "$ ably stats account VgQpOZ",
    "$ ably stats account mycompany --start 1h",
    "$ ably stats account mycompany --json",
    "$ ably stats account mycompany --live",
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
    const { args, flags } = await this.parse(StatsAccountCommand);

    let controlApi: ControlApi;

    if (args.accountAliasOrId) {
      const resolvedAlias = this.resolveAccountAlias(
        args.accountAliasOrId,
        flags,
      );
      const accessToken = this.configManager.getAccessToken(resolvedAlias);
      if (!accessToken) {
        this.fail(
          `No access token found for account "${resolvedAlias}". Please log in again with "ably accounts login".`,
          flags,
          "statsAccount",
        );
      }
      controlApi = new ControlApi({
        accessToken,
        controlHost: flags["control-host"],
      });
    } else {
      controlApi = this.createControlApi(flags);
    }

    try {
      await this.runStats(flags, controlApi);
    } catch (error) {
      this.fail(error, flags, "statsAccount");
    }
  }
}
