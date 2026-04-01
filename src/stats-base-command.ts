import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "./control-base-command.js";
import { timeRangeFlags } from "./flags.js";
import { StatsDisplay, StatsDisplayData } from "./services/stats-display.js";
import type { BaseFlags } from "./types/cli.js";
import type { ControlApi } from "./services/control-api.js";
import { errorMessage } from "./utils/errors.js";
import { parseTimestamp } from "./utils/time.js";

export abstract class StatsBaseCommand extends ControlBaseCommand {
  static statsFlags = {
    ...ControlBaseCommand.globalFlags,
    debug: Flags.boolean({
      default: false,
      description: "Show debug information for live stats polling",
    }),
    ...timeRangeFlags,
    interval: Flags.integer({
      default: 6,
      description: "Polling interval in seconds (only used with --live)",
    }),
    limit: Flags.integer({
      default: 10,
      description: "Maximum number of results to return",
      min: 1,
    }),
    live: Flags.boolean({
      default: false,
      description: "Subscribe to live stats updates (uses minute interval)",
    }),
    unit: Flags.string({
      default: "minute",
      description: "Time unit for stats",
      options: ["minute", "hour", "day", "month"],
    }),
  };

  protected isPolling = false;
  protected pollInterval: NodeJS.Timeout | undefined = undefined;
  protected statsDisplay: StatsDisplay | null = null;

  protected abstract fetchStats(
    controlApi: ControlApi,
    params: { end: number; limit: number; start: number; unit: string },
  ): Promise<StatsDisplayData[]>;

  protected abstract getStatsLabel(
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<string>;

  protected getStatsDisplayOptions(): Record<string, unknown> {
    return {};
  }

  protected async runStats(
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    if (flags.live && flags.unit !== "minute") {
      this.logWarning(
        "Live stats only support minute intervals. Using minute interval.",
        flags,
      );
      flags.unit = "minute";
    }

    await this.showAuthInfoIfNeeded(flags);

    this.statsDisplay = new StatsDisplay({
      command: this.id,
      intervalSeconds: flags.interval as number,
      json: this.shouldOutputJson(flags),
      live: flags.live as boolean,
      logger: (...args: unknown[]) => this.log(args.map(String).join(" ")),
      prettyJson: this.isPrettyJsonOutput(flags),
      startTime: flags.live ? new Date() : undefined,
      unit: flags.unit as "day" | "hour" | "minute" | "month",
      ...this.getStatsDisplayOptions(),
    });

    await (flags.live
      ? this.runLiveStats(flags, controlApi)
      : this.runOneTimeStats(flags, controlApi));
  }

  private async fetchAndDisplayStats(
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats = await this.fetchStats(controlApi, {
        end: now.getTime(),
        limit: 1,
        start: start.getTime(),
        unit: flags.unit as string,
      });

      if (stats.length > 0) {
        this.statsDisplay!.display(stats[0]!);
      }
    } catch (error) {
      this.fail(error, flags, "stats");
    }
  }

  private async pollStats(
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      this.isPolling = true;
      if (flags.debug) {
        this.logToStderr(
          chalk.dim(`\n[${new Date().toISOString()}] Polling for new stats...`),
        );
      }

      await this.fetchAndDisplayStats(flags, controlApi);
    } catch (error) {
      if (flags.debug) {
        this.logToStderr(
          chalk.red(`Error during stats polling: ${errorMessage(error)}`),
        );
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async runLiveStats(
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      const label = await this.getStatsLabel(flags, controlApi);
      this.logProgress(`Subscribing to live stats for ${label}`, flags);

      const isJson = this.shouldOutputJson(flags);
      const cleanup = () => {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = undefined;
        }

        if (!isJson) {
          this.log("\nUnsubscribed from live stats");
        }
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      await this.fetchAndDisplayStats(flags, controlApi);

      this.pollInterval = setInterval(
        () => {
          if (!this.isPolling) {
            void this.pollStats(flags, controlApi);
          } else if (flags.debug) {
            this.logToStderr(
              chalk.yellow(
                "Skipping poll - previous request still in progress",
              ),
            );
          }
        },
        (flags.interval as number) * 1000,
      );

      await new Promise<void>(() => {
        // Intentionally never resolved - exits via SIGINT/SIGTERM
      });
    } catch (error) {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }

      this.fail(error, flags, "stats");
    }
  }

  private async runOneTimeStats(
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      const label = await this.getStatsLabel(flags, controlApi);
      this.logProgress(`Fetching stats for ${label}`, flags);

      let startMs: number | undefined;
      let endMs: number | undefined;

      if (flags.start) {
        startMs = parseTimestamp(flags.start as string, "start");
      }

      if (flags.end) {
        endMs = parseTimestamp(flags.end as string, "end");
      }

      if (startMs === undefined && endMs === undefined) {
        const now = Date.now();
        endMs = now;
        startMs = now - 24 * 60 * 60 * 1000;
      } else if (startMs !== undefined && endMs === undefined) {
        endMs = Date.now();
      } else if (startMs === undefined && endMs !== undefined) {
        startMs = endMs - 24 * 60 * 60 * 1000;
      }

      if (startMs! > endMs!) {
        this.fail(
          "--start must be earlier than or equal to --end",
          flags,
          "stats",
        );
      }

      const stats = await this.fetchStats(controlApi, {
        end: endMs!,
        limit: flags.limit as number,
        start: startMs!,
        unit: flags.unit as string,
      });

      if (stats.length === 0) {
        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ stats: [] }, flags);
        } else {
          this.log("No stats found for the specified period");
        }

        return;
      }

      for (const stat of stats) {
        this.statsDisplay!.display(stat);
      }
    } catch (error) {
      this.fail(error, flags, "stats");
    }
  }
}
