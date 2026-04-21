import { ControlBaseCommand } from "../control-base-command.js";
import AccountsLogin from "./accounts/login.js";

export default class Login extends ControlBaseCommand {
  static override description =
    'Log in to your Ably account (alias for "ably accounts login")';

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --alias mycompany",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = AccountsLogin.flags;

  public async run(): Promise<void> {
    // Login's own init/finally (from ControlBaseCommand) handle the lifecycle:
    // web-CLI restriction check, ABLY_CURRENT_COMMAND, JSON completed signal,
    // cached-client cleanup. AccountsLogin is run manually so its finally
    // doesn't emit a duplicate completed signal.
    const accountsLogin = new AccountsLogin(this.argv, this.config);
    await accountsLogin.run();
  }
}
