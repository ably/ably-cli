import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { endpointFlag } from "../../flags.js";
import { ControlApi } from "../../services/control-api.js";
import { formatResource } from "../../utils/output.js";

export default class AccountsSwitch extends ControlBaseCommand {
  static override args = {
    accountAliasOrId: Args.string({
      description: "Alias or ID of the account to switch to",
      required: false,
    }),
  };

  static override description = "Switch to a different Ably account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> mycompany",
    "<%= config.bin %> <%= command.id %> VgQpOZ",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    ...endpointFlag,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AccountsSwitch);

    // Get available accounts
    const accounts = this.configManager.listAccounts();

    if (accounts.length === 0) {
      if (this.shouldOutputJson(flags)) {
        this.fail(
          'No accounts configured. Use "ably accounts login" to add an account.',
          flags,
          "accountSwitch",
        );
      }

      // In interactive mode, proxy to login
      this.logProgress("No accounts configured. Redirecting to login", flags);
      await this.config.runCommand("accounts:login");
      return;
    }

    // If alias or ID is provided, resolve and switch directly.
    // The accountAliasOrId arg accepts two formats:
    //   1. Account alias  — e.g. "mycompany" (the label set during login)
    //   2. Account ID     — e.g. "VgQpOZ"    (the Ably-assigned account ID)
    //
    // Resolution is handled by resolveAccountAlias() which matches alias
    // first, then accountId. When omitted, an interactive prompt is shown.
    if (args.accountAliasOrId) {
      const resolvedAlias = this.resolveAccountAlias(
        args.accountAliasOrId,
        flags,
      );
      await this.switchToAccount(resolvedAlias, accounts, flags);
      return;
    }

    // Otherwise, show interactive selection if not in JSON mode
    if (this.shouldOutputJson(flags)) {
      this.fail(
        'No account alias or ID provided. Run "ably accounts list" to see available accounts.',
        flags,
        "accountSwitch",
        {
          availableAccounts: accounts.map(({ account, alias }) => ({
            alias,
            id: account.accountId,
            name: account.accountName,
          })),
        },
      );
    }

    this.log("Select an account to switch to:");
    const selectedAccount = await this.interactiveHelper.selectAccount();

    if (selectedAccount) {
      await this.switchToAccount(selectedAccount.alias, accounts, flags);
    } else {
      this.logWarning("Account switch cancelled.", flags);
    }
  }

  private async switchToAccount(
    alias: string,
    accounts: Array<{
      account: { accountId: string; accountName: string };
      alias: string;
    }>,
    flags: Record<string, unknown>,
  ): Promise<void> {
    // Check if account exists
    const accountExists = accounts.some((account) => account.alias === alias);

    if (!accountExists) {
      this.fail(
        `Account with alias "${alias}" not found. Use "ably accounts list" to see available accounts.`,
        flags,
        "accountSwitch",
        {
          availableAccounts: accounts.map(({ account, alias }) => ({
            alias,
            id: account.accountId,
            name: account.accountName,
          })),
        },
      );
    }

    // Switch to the account
    this.configManager.switchAccount(alias);

    // Store custom endpoint if provided
    if (flags.endpoint) {
      this.configManager.storeEndpoint(flags.endpoint as string);
    }

    // Verify the account is valid by making an API call
    try {
      const accessToken = this.configManager.getAccessToken();
      if (!accessToken) {
        this.fail(
          'No access token found for this account. Run "ably accounts login" to log in again.',
          flags,
          "accountSwitch",
        );
      }

      const controlApi = new ControlApi({
        accessToken,
        controlHost: flags["control-host"] as string | undefined,
      });

      const { account, user } = await controlApi.getMe();

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: {
              alias,
              id: account.id,
              name: account.name,
              user: {
                email: user.email,
              },
            },
          },
          flags,
        );
      } else {
        this.logSuccessMessage(
          `Switched to account ${formatResource(account.name)} (${account.id}).`,
          flags,
        );
        this.log(`User: ${user.email}`);
      }
    } catch {
      // The account switch already happened above (line 109), so this is non-fatal.
      // Warn the user but still report success with a warning field.
      const warningMessage =
        "Access token may have expired or is invalid. The account was switched, but token verification failed.";
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: { alias },
            warning: warningMessage,
          },
          flags,
        );
      } else {
        this.logWarning(warningMessage, flags);
      }
    }
  }
}
