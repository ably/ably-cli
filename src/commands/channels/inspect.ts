import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import openUrl from "../../utils/open-url.js";

export default class ChannelsInspect extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The name of the channel to inspect in the Ably dashboard",
      required: true,
    }),
  };

  static override description =
    "Open the Ably dashboard to inspect a specific channel";

  static override examples = ["<%= config.bin %> <%= command.id %> my-channel"];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID to use (uses current app if not specified)",
      env: "ABLY_APP_ID",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsInspect);

    const currentAccount = this.configManager.getCurrentAccount();
    const accountId = currentAccount?.accountId;
    if (!accountId) {
      this.error(
        `No account configured. Please log in first with ${chalk.cyan('"ably accounts login"')}.`,
      );
    }

    const appId = flags.app ?? this.configManager.getCurrentAppId();
    if (!appId) {
      this.error(
        `No app selected. Please select an app first with ${chalk.cyan('"ably apps switch"')} or specify one with ${chalk.cyan("--app")}.`,
      );
    }

    let dashboardHost = flags["dashboard-host"] ?? "https://ably.com";
    if (dashboardHost && !/^https?:\/\//i.test(dashboardHost)) {
      dashboardHost = `https://${dashboardHost}`;
    }
    const url = `${dashboardHost}/accounts/${accountId}/apps/${appId}/channels/${encodeURIComponent(args.channel)}`;

    await openUrl(url, this);
  }
}
