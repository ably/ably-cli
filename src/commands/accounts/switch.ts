import { Args } from "@oclif/core";
import chalk from "chalk";
import inquirer from "inquirer";

import { ControlBaseCommand } from "../../control-base-command.js";
import { endpointFlag } from "../../flags.js";
import { type AccountSummary } from "../../services/control-api.js";
import { formatResource } from "../../utils/output.js";
import { pickUniqueAlias, slugifyAccountName } from "../../utils/slugify.js";

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

    const localAccounts = this.configManager.listAccounts();

    if (localAccounts.length === 0) {
      if (this.shouldOutputJson(flags)) {
        this.fail(
          'No accounts configured. Run "ably accounts login" to add an account.',
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
    if (args.accountAliasOrId) {
      const resolvedAlias = this.resolveAccountAlias(
        args.accountAliasOrId,
        flags,
      );
      await this.switchToLocalAccount(resolvedAlias, flags);
      return;
    }

    // JSON mode requires an explicit alias
    if (this.shouldOutputJson(flags)) {
      this.fail(
        'No account alias or ID provided. Run "ably accounts list" to see available accounts.',
        flags,
        "accountSwitch",
        {
          availableAccounts: localAccounts.map(({ account, alias }) => ({
            alias,
            id: account.accountId,
            name: account.accountName,
          })),
        },
      );
    }

    // Interactive mode: show local aliases + remote accounts
    const selected = await this.interactiveSwitch(localAccounts, flags);

    if (!selected) {
      this.logWarning("Account switch cancelled.", flags);
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

    // Try to fetch remote accounts using the current token.
    let remoteAccounts: AccountSummary[] = [];
    if (this.configManager.getAccessToken()) {
      try {
        const controlApi = this.createControlApi(flags);
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

    const { selected } = (await inquirer.prompt([
      {
        choices,
        message: "Select an account:",
        name: "selected",
        type: "list",
      },
    ])) as {
      selected:
        | { type: "local"; alias: string }
        | { type: "remote"; account: AccountSummary };
    };

    if (selected.type === "local") {
      await this.switchToLocalAccount(selected.alias, flags);
      return true;
    }

    // Remote account — create a local alias using the current token
    this.addAndSwitchToRemoteAccount(selected.account, flags);
    return true;
  }

  private addAndSwitchToRemoteAccount(
    remoteAccount: AccountSummary,
    flags: Record<string, unknown>,
  ): void {
    const currentAlias = this.configManager.getCurrentAccountAlias();
    if (!currentAlias) {
      this.fail(
        "No current account to copy credentials from.",
        flags,
        "accountSwitch",
      );
    }

    const oauthTokens = this.configManager.getOAuthTokens(currentAlias);
    if (!oauthTokens) {
      this.fail(
        "Current account does not use OAuth. Please log in with the target account directly.",
        flags,
        "accountSwitch",
      );
    }

    const currentAccount = this.configManager.getCurrentAccount();
    // Pick a non-colliding alias — two different remote accounts whose names
    // slugify identically (e.g. "Acme Prod" / "Acme-Prod") must not silently
    // rebind an existing alias to a different accountId.
    const picked = pickUniqueAlias(
      slugifyAccountName(remoteAccount.name),
      remoteAccount.id,
      this.configManager.listAccounts(),
    );
    const newAlias = picked.alias;
    if (picked.collidedWith) {
      this.logWarning(
        `Alias "${picked.collidedWith.alias}" is already used by a different account (${picked.collidedWith.accountId}); storing this account as "${newAlias}" instead.`,
        flags,
      );
    }

    // Store the new alias with the same OAuth tokens but different account info.
    // Carry over the source account's oauthHost (so the shared session key
    // resolves correctly) and controlHost (so later Control API calls keep
    // targeting the same deployment).
    this.configManager.storeOAuthTokens(
      newAlias,
      {
        ...oauthTokens,
        userEmail: currentAccount?.userEmail,
      },
      {
        accountId: remoteAccount.id,
        accountName: remoteAccount.name,
        controlHost: currentAccount?.controlHost,
        oauthHost: currentAccount?.oauthHost,
      },
    );

    this.configManager.switchAccount(newAlias);

    // Store custom endpoint if provided — parity with switchToLocalAccount so
    // the flag is not silently dropped when the user picks a remote account.
    if (flags.endpoint) {
      this.configManager.storeEndpoint(flags.endpoint as string);
    }

    this.log(
      `Switched to account: ${formatResource(remoteAccount.name)} (${remoteAccount.id})`,
    );
    this.log(`Saved as alias: ${formatResource(newAlias)}`);
  }

  private async switchToLocalAccount(
    alias: string,
    flags: Record<string, unknown>,
  ): Promise<void> {
    // Alias is already validated by resolveAccountAlias() or interactive
    // selection before reaching this method.
    this.configManager.switchAccount(alias);

    // Store custom endpoint if provided
    if (flags.endpoint) {
      this.configManager.storeEndpoint(flags.endpoint as string);
    }

    // Verify the account is valid by making an API call.
    try {
      const controlApi = this.createControlApi(flags);

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
      // The account switch already happened above, so this is non-fatal.
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
