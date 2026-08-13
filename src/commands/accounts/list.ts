import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatLabel } from "../../utils/output.js";
import { formatEndpointUrl } from "../../utils/server-url.js";

export default class AccountsList extends ControlBaseCommand {
  static override description = "List locally configured Ably accounts";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AccountsList);

    // Get all accounts from config
    const accounts = this.configManager.listAccounts();
    const currentAlias = this.configManager.getCurrentAccountAlias();

    if (accounts.length === 0) {
      this.fail(
        'No accounts configured. Use "ably accounts login" to add an account.',
        flags,
        "accountList",
        { accounts: [] },
      );
    }

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult(
        {
          accounts: accounts.map(({ account, alias }) => {
            const dataPlane = this.configManager.getDataPlane(alias);

            return {
              alias,
              appsConfigured: account.apps
                ? Object.keys(account.apps).length
                : 0,
              ...(account.authMethod ? { authMethod: account.authMethod } : {}),
              ...(account.controlUrl ? { controlUrl: account.controlUrl } : {}),
              currentApp:
                alias === currentAlias && account.currentAppId
                  ? {
                      id: account.currentAppId,
                      name:
                        this.configManager.getAppName(account.currentAppId) ||
                        account.currentAppId,
                    }
                  : undefined,
              // Same shape as `accounts login --local` and `accounts switch`
              // report, so the server can be read the same way everywhere.
              ...(dataPlane
                ? {
                    dataPlane: {
                      ...dataPlane,
                      url: formatEndpointUrl(dataPlane),
                    },
                  }
                : {}),
              // A local server assigns no account ID and knows no user, so
              // those keys are omitted rather than emitted empty.
              ...(account.accountId ? { id: account.accountId } : {}),
              isCurrent: alias === currentAlias,
              name: account.accountName,
              ...(account.userEmail ? { user: account.userEmail } : {}),
            };
          }),
          currentAccount: currentAlias,
        },
        flags,
      );
      return;
    }

    this.log(`Found ${accounts.length} accounts:\n`);

    for (const { account, alias } of accounts) {
      const isCurrent = alias === currentAlias;
      const prefix = isCurrent ? chalk.green("▶ ") : "  ";
      const titleStyle = isCurrent ? chalk.green.bold : chalk.bold;

      this.log(
        prefix +
          titleStyle(`Account: ${alias}`) +
          (isCurrent ? chalk.green(" (current)") : ""),
      );
      // A local server account is named after its alias and has no
      // server-assigned ID, so the Name line would just repeat the heading.
      if (account.accountName !== alias || account.accountId) {
        this.log(
          `  ${formatLabel("Name")} ${account.accountName}${account.accountId ? ` (${account.accountId})` : ""}`,
        );
      }
      if (account.userEmail) {
        this.log(`  ${formatLabel("User")} ${account.userEmail}`);
      }

      // The server is what distinguishes two local profiles from each other,
      // so it is reported here as a URL — the same form used by the "Using:"
      // banner, `accounts current` and `accounts switch`.
      const endpoint = formatEndpointUrl(
        this.configManager.getDataPlane(alias),
      );
      if (endpoint) {
        this.log(`  ${formatLabel("Endpoint")} ${chalk.blue(endpoint)}`);
      }
      if (account.controlUrl) {
        this.log(
          `  ${formatLabel("Control plane")} ${chalk.blue(account.controlUrl)}`,
        );
      }

      // Count number of apps configured for this account
      const appCount = account.apps ? Object.keys(account.apps).length : 0;
      this.log(`  ${formatLabel("Apps configured")} ${appCount}`);

      // Show current app if one is selected and this is the current account
      if (isCurrent && account.currentAppId) {
        const appName =
          this.configManager.getAppName(account.currentAppId) ||
          account.currentAppId;
        this.log(
          `  ${formatLabel("Current app")} ${appName} (${account.currentAppId})`,
        );
      }

      this.log(""); // Add a blank line between accounts
    }
  }
}
