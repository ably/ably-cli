import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { timeRangeFlags } from "../../flags.js";
import { StatsDisplay } from "../../services/stats-display.js";
import type { BaseFlags } from "../../types/cli.js";
import type { ControlApi } from "../../services/control-api.js";
import { progress, resource } from "../../utils/output.js";
import { parseTimestamp } from "../../utils/time.js";

export default class StatsAppCommand extends ControlBaseCommand {
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

  static flags = {
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
      description: "Maximum number of results to return (default: 10)",
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

  private isPolling = false;
  private pollInterval: NodeJS.Timeout | undefined = undefined;
  private statsDisplay: StatsDisplay | null = null; // Track when we're already fetching stats

  async run(): Promise<void> {
    const { args, flags } = await this.parse(StatsAppCommand);

    // Use provided app ID or fall back to default app ID
    const appId = args.id || this.configManager.getCurrentAppId();

    if (!appId) {
      this.error(
        'No app ID provided and no default app selected. Please specify an app ID or select a default app with "ably apps switch".',
      );
      return;
    }

    // For live stats, enforce minute interval
    if (flags.live && flags.unit !== "minute") {
      this.warn(
        "Live stats only support minute intervals. Using minute interval.",
      );
      flags.unit = "minute";
    }

    // Display authentication information
    await this.showAuthInfoIfNeeded(flags);

    const controlApi = this.createControlApi(flags);

    // Create stats display
    this.statsDisplay = new StatsDisplay({
      intervalSeconds: flags.interval as number,
      json: this.shouldOutputJson(flags),
      live: flags.live,
      startTime: flags.live ? new Date() : undefined,
      unit: flags.unit as "day" | "hour" | "minute" | "month",
    });

    await (flags.live
      ? this.runLiveStats(appId, flags, controlApi)
      : this.runOneTimeStats(appId, flags, controlApi));
  }

  private async fetchAndDisplayStats(
    appId: string,
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

      const stats = await controlApi.getAppStats(appId, {
        end: now.getTime(),
        limit: 1, // Only get the most recent stats for live updates
        start: start.getTime(),
        unit: flags.unit as string,
      });

      if (stats.length > 0) {
        this.statsDisplay!.display(stats[0]);
      }
    } catch (error) {
      this.error(
        `Error fetching stats: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async pollStats(
    appId: string,
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      this.isPolling = true;
      if (flags.debug) {
        this.log(
          chalk.dim(`\n[${new Date().toISOString()}] Polling for new stats...`),
        );
      }

      await this.fetchAndDisplayStats(appId, flags, controlApi);
    } catch (error) {
      if (flags.debug) {
        this.logToStderr(
          chalk.red(
            `Error during stats polling: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async runLiveStats(
    appId: string,
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(
          progress(`Subscribing to live stats for app ${resource(appId)}`),
        );
      }

      // Setup graceful shutdown
      const cleanup = () => {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = undefined;
        }

        this.log("\nUnsubscribed from live stats");
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Show stats immediately before starting polling
      await this.fetchAndDisplayStats(appId, flags, controlApi);

      // Poll for stats at the specified interval
      this.pollInterval = setInterval(
        () => {
          // Use non-blocking polling - don't wait for previous poll to complete
          if (!this.isPolling) {
            this.pollStats(appId, flags, controlApi);
          } else if (flags.debug) {
            // Only show this message if debug flag is enabled
            this.log(
              chalk.yellow(
                "Skipping poll - previous request still in progress",
              ),
            );
          }
        },
        (flags.interval as number) * 1000,
      );

      // Keep the process running
      await new Promise<void>(() => {
        // This promise is intentionally never resolved
        // The process will exit via the SIGINT/SIGTERM handlers
      });
    } catch (error) {
      this.error(
        `Error setting up live stats: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
    }
  }

  private async runOneTimeStats(
    appId: string,
    flags: BaseFlags,
    controlApi: ControlApi,
  ): Promise<void> {
    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(progress(`Fetching stats for app ${resource(appId)}`));
      }

      // Parse start/end if provided, otherwise default to last 24 hours
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
        startMs = now - 24 * 60 * 60 * 1000; // 24 hours ago
      }

      const stats = await controlApi.getAppStats(appId, {
        end: endMs,
        limit: flags.limit as number,
        start: startMs,
        unit: flags.unit as string,
      });

      if (stats.length === 0) {
        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput({ stats: [], success: true }, flags));
        } else {
          this.log("No stats found for the specified period");
        }
        return;
      }

      // Display each stat interval
      for (const stat of stats) {
        this.statsDisplay!.display(stat);
      }
    } catch (error) {
      this.error(
        `Error fetching app stats: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
