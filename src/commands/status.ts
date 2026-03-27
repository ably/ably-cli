import { Flags } from "@oclif/core";
import chalk from "chalk";
import fetch from "node-fetch";
import ora from "ora";

import { AblyBaseCommand } from "../base-command.js";
import { coreGlobalFlags } from "../flags.js";
import { BaseFlags } from "../types/cli.js";
import openUrl from "../utils/open-url.js";
import { formatProgress, formatSuccess } from "../utils/output.js";
import { getCliVersion } from "../utils/version.js";

interface StatusResponse {
  status: boolean;
}

export default class StatusCommand extends AblyBaseCommand {
  static description = "Check the status of the Ably service";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = {
    ...coreGlobalFlags,
    open: Flags.boolean({
      char: "o",
      default: false,
      description: "Open the Ably status page in a browser",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StatusCommand);
    const isJson = this.shouldOutputJson(flags);

    const isInteractive = process.env.ABLY_INTERACTIVE_MODE === "true";
    const spinner =
      isInteractive || isJson
        ? null
        : ora("Checking Ably service status...").start();
    if (isInteractive && !isJson) {
      this.log(formatProgress("Checking Ably service status"));
    }

    try {
      const response = await fetch("https://ably.com/status/up.json", {
        headers: {
          "Ably-Agent": `ably-cli/${getCliVersion()}`,
        },
      });
      const data = (await response.json()) as StatusResponse;
      if (spinner) spinner.stop();

      if (data.status === undefined) {
        this.fail(
          new Error(
            "Invalid response from status endpoint: status attribute is missing",
          ),
          flags as BaseFlags,
          "status",
        );
      }

      if (isJson) {
        this.logJsonResult(
          {
            operational: data.status,
            statusUrl: "https://status.ably.com",
          },
          flags as BaseFlags,
        );
      } else if (data.status) {
        this.log(formatSuccess("Ably services are operational."));
        this.log("No incidents currently reported");
      } else {
        this.log(
          `${chalk.red("⨯")} ${chalk.red("Incident detected")} - There are currently open incidents`,
        );
      }

      if (!isJson) {
        this.log(
          `\nFor detailed status information, visit ${chalk.cyan("https://status.ably.com")}`,
        );
      }

      if (flags.open) {
        await openUrl("https://status.ably.com", this);
      }
    } catch (error) {
      if (spinner) {
        spinner.fail("Failed to check Ably service status");
      }

      this.fail(error, flags as BaseFlags, "status");
    }
  }
}
