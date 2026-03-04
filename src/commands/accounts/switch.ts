import { Args } from "@oclif/core";
import chalk from "chalk";
import inquirer from "inquirer";

import { ControlBaseCommand } from "../../control-base-command.js";
import { ControlApi, type AccountSummary } from "../../services/control-api.js";
import { slugifyAccountName } from "../../utils/slugify.js";

export default class AccountsSwitch extends ControlBaseCommand {
  static override args = {
    alias: Args.string({
      description: "Alias of the account to switch to",
      required: false,
    }),
  };

  static override description = "Switch to a different Ably account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> mycompany",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AccountsSwitch);

    const localAccounts = this.configManager.listAccounts();

    if (localAccounts.length === 0) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error:
              'No accounts configured. Use "ably accounts login" to add an account.',
            success: false,
          },
          flags,
        );
        return;
      }

      this.log("No accounts configured. Redirecting to login...");
      await this.config.runCommand("accounts:login");
      return;
    }

    // If alias is provided, switch directly
    if (args.alias) {
      await this.switchToLocalAccount(args.alias, localAccounts, flags);
      return;
    }

    // JSON mode requires an explicit alias
    if (this.shouldOutputJson(flags)) {
      this.jsonError(
        {
          availableAccounts: localAccounts.map(({ account, alias }) => ({
            alias,
            id: account.accountId || "Unknown",
            name: account.accountName || "Unknown",
          })),
          error:
            "No account alias provided. Please specify an account alias to switch to.",
          success: false,
        },
        flags,
      );
      return;
    }

    // Interactive mode: show local aliases + remote accounts
    const selected = await this.interactiveSwitch(localAccounts, flags);

    if (!selected) {
      this.log("Account switch cancelled.");
    }
  }

  private async interactiveSwitch(
    localAccounts: Array<{
      account: {
        accountId?: string;
        accountName?: string;
        userEmail?: string;
      };
      alias: string;
    }>,
    flags: Record<string, unknown>,
  ): Promise<boolean> {
    const currentAlias = this.configManager.getCurrentAccountAlias();

    // Try to fetch remote accounts using the current token
    let remoteAccounts: AccountSummary[] = [];
    const accessToken = this.configManager.getAccessToken();
    if (accessToken) {
      try {
        const currentAccount = this.configManager.getCurrentAccount();
        const controlHost =
          (flags["control-host"] as string | undefined) ||
          currentAccount?.controlHost;
        const controlApi = new ControlApi({
          accessToken,
          controlHost,
        });
        remoteAccounts = await controlApi.getAccounts();
      } catch {
        // Couldn't fetch remote accounts — fall back to local only
      }
    }

    // Build local account IDs set for deduplication
    const localAccountIds = new Set(
      localAccounts.map((a) => a.account.accountId).filter(Boolean),
    );

    // Remote accounts not already configured locally
    const remoteOnly = remoteAccounts.filter((r) => !localAccountIds.has(r.id));

    type Choice = {
      name: string;
      value:
        | { type: "local"; alias: string }
        | { type: "remote"; account: AccountSummary };
    };

    const choices: Array<Choice | inquirer.Separator> = [];

    // Local accounts section
    if (localAccounts.length > 0) {
      choices.push(new inquirer.Separator("── Local accounts ──"));
      for (const { account, alias } of localAccounts) {
        const isCurrent = alias === currentAlias;
        const name = account.accountName || account.accountId || "Unknown";
        const label = `${isCurrent ? "* " : "  "}${alias} ${chalk.dim(`(${name})`)}`;
        choices.push({ name: label, value: { type: "local", alias } });
      }
    }

    // Remote-only accounts section
    if (remoteOnly.length > 0) {
      choices.push(
        new inquirer.Separator("── Other accounts (no login required) ──"),
      );
      for (const account of remoteOnly) {
        const label = `  ${account.name} ${chalk.dim(`(${account.id})`)}`;
        choices.push({ name: label, value: { type: "remote", account } });
      }
    }

    if (choices.length === 0) {
      this.log("No accounts available.");
      return false;
    }

    const { selected } = await inquirer.prompt([
      {
        choices,
        message: "Select an account:",
        name: "selected",
        type: "list",
      },
    ]);

    if (selected.type === "local") {
      await this.switchToLocalAccount(selected.alias, localAccounts, flags);
      return true;
    }

    // Remote account — create a local alias using the current token
    await this.addAndSwitchToRemoteAccount(selected.account);
    return true;
  }

  private async addAndSwitchToRemoteAccount(
    remoteAccount: AccountSummary,
  ): Promise<void> {
    const currentAlias = this.configManager.getCurrentAccountAlias();
    if (!currentAlias) {
      this.error("No current account to copy credentials from.");
      return;
    }

    const oauthTokens = this.configManager.getOAuthTokens(currentAlias);
    if (!oauthTokens) {
      this.error(
        "Current account does not use OAuth. Please log in with the target account directly.",
      );
      return;
    }

    const currentAccount = this.configManager.getCurrentAccount();
    const newAlias = slugifyAccountName(remoteAccount.name);

    // Store the new alias with the same OAuth tokens but different account info
    this.configManager.storeOAuthTokens(
      newAlias,
      {
        ...oauthTokens,
        userEmail: currentAccount?.userEmail,
      },
      {
        accountId: remoteAccount.id,
        accountName: remoteAccount.name,
      },
    );

    // Carry over control host from the source account
    if (currentAccount?.controlHost) {
      this.configManager.setAccountControlHost(
        newAlias,
        currentAccount.controlHost,
      );
    }

    this.configManager.switchAccount(newAlias);

    this.log(
      `Switched to account: ${chalk.cyan(remoteAccount.name)} (${remoteAccount.id})`,
    );
    this.log(`Saved as alias: ${chalk.cyan(newAlias)}`);
  }

  private async switchToLocalAccount(
    alias: string,
    accounts: Array<{
      account: { accountId?: string; accountName?: string };
      alias: string;
    }>,
    flags: Record<string, unknown>,
  ): Promise<void> {
    const accountExists = accounts.some((account) => account.alias === alias);

    if (!accountExists) {
      const error = `Account with alias "${alias}" not found. Use "ably accounts list" to see available accounts.`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            availableAccounts: accounts.map(({ account, alias }) => ({
              alias,
              id: account.accountId || "Unknown",
              name: account.accountName || "Unknown",
            })),
            error,
            success: false,
          },
          flags,
        );
        return;
      } else {
        this.error(error);
      }

      return;
    }

    this.configManager.switchAccount(alias);

    try {
      const accessToken = this.configManager.getAccessToken();
      if (!accessToken) {
        const error =
          "No access token found for this account. Please log in again.";
        if (this.shouldOutputJson(flags)) {
          this.jsonError({ error, success: false }, flags);
          return;
        } else {
          this.error(error);
        }

        return;
      }

      const controlApi = new ControlApi({
        accessToken,
        controlHost: flags["control-host"] as string | undefined,
      });

      const { account, user } = await controlApi.getMe();

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              account: {
                alias,
                id: account.id,
                name: account.name,
                user: { email: user.email },
              },
              success: true,
            },
            flags,
          ),
        );
      } else {
        this.log(`Switched to account: ${account.name} (${account.id})`);
        this.log(`User: ${user.email}`);
      }
    } catch {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            account: { alias },
            error: "Access token may have expired or is invalid.",
            success: false,
          },
          flags,
        );
        return;
      } else {
        this.warn(
          "Switched to account, but the access token may have expired or is invalid.",
        );
        this.log(
          `Consider logging in again with "ably accounts login --alias ${alias}".`,
        );
      }
    }
  }
}
