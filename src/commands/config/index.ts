import { AblyBaseCommand } from "../../base-command.js";

export default class ConfigIndex extends AblyBaseCommand {
  static override description = "Manage Ably CLI configuration";

  static override examples = [
    "<%= config.bin %> config path",
    "<%= config.bin %> config show",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    await this.config.runCommand("help", ["config"]);
  }
}
