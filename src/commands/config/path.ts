import * as fs from "node:fs";

import { AblyBaseCommand } from "../../base-command.js";

export default class ConfigPath extends AblyBaseCommand {
  static override description = "Print the path to the Ably CLI config file";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "# Open in your preferred editor:",
    "code $(ably config path)",
    "vim $(ably config path)",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConfigPath);

    const configPath = this.configManager.getConfigPath();

    // Create the config file if it doesn't exist
    if (!fs.existsSync(configPath)) {
      this.configManager.saveConfig();
    }

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ path: configPath }, flags));
    } else {
      this.log(configPath);
    }
  }
}
