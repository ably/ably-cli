import { Args, Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../base-command.js";
import { hiddenControlApiFlags, productApiFlags } from "../../flags.js";
import openUrl from "../../utils/open-url.js";
import { formatResource } from "../../utils/output.js";

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
    ...productApiFlags,
    ...hiddenControlApiFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsInspect);

    const currentAccount = this.configManager.getCurrentAccount();
    const accountId = currentAccount?.accountId;
    if (!accountId) {
      this.fail(
        `No account configured. Please log in first with ${formatResource("ably accounts login")}.`,
        flags,
        "ChannelInspect",
      );
    }

    const appId = flags.app ?? this.configManager.getCurrentAppId();
    if (!appId) {
      this.fail(
        `No app selected. Please select an app first with ${formatResource("ably apps switch")} or specify one with ${formatResource("--app")}.`,
        flags,
        "ChannelInspect",
      );
    }

    let dashboardHost = flags["dashboard-host"] ?? "https://ably.com";
    if (dashboardHost && !/^https?:\/\//i.test(dashboardHost)) {
      dashboardHost = `https://${dashboardHost}`;
    }
    const url = `${dashboardHost}/accounts/${accountId}/apps/${appId}/channels/${encodeURIComponent(args.channel)}`;

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult({ channel: { url } }, flags);
    } else {
      await openUrl(url, this);
    }
  }
}
