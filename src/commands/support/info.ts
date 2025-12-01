import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import openUrl from "../../utils/open-url.js";
import isWebCliMode from "../../utils/web-mode.js";

export default class InfoCommand extends Command {
  static description = "General support resources and documentation links";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  static flags = {
    help: Flags.help({ char: "h" }),
  };

  async run(): Promise<void> {
    await this.parse(InfoCommand);

    const url = "https://ably.com/support";

    if (isWebCliMode()) {
      this.log(`${chalk.cyan("Support resources:")} ${url}`);
    } else {
      await openUrl(url, this);
    }
  }
}
