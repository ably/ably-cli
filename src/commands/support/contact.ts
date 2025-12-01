import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import open from "open";

export default class ContactCommand extends Command {
  static description = "Contact Ably for assistance";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  static flags = {
    help: Flags.help({ char: "h" }),
  };

  async run(): Promise<void> {
    await this.parse(ContactCommand);

    const url = "https://ably.com/contact";
    const isWebCliMode = process.env.ABLY_WEB_CLI_MODE === "true";

    if (isWebCliMode) {
      this.log(`${chalk.cyan("Contact Ably:")} ${url}`);
    } else {
      this.log(
        `${chalk.cyan("Opening")} ${url} ${chalk.cyan("in your browser")}...`,
      );
      await open(url);
    }
  }
}
