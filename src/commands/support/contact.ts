import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import openUrl from "../../utils/open-url.js";
import isWebCliMode from "../../utils/web-mode.js";

export default class ContactCommand extends Command {
  static description = "Contact Ably for assistance";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  static flags = {
    help: Flags.help({ char: "h" }),
  };

  async run(): Promise<void> {
    await this.parse(ContactCommand);

    const url = "https://ably.com/support";

    if (isWebCliMode()) {
      this.log(`${chalk.cyan("Visit")} ${url}`);
    } else {
      await openUrl(url, this);
    }
  }
}
