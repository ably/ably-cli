import { AblyBaseCommand } from "../../base-command.js";
import { coreGlobalFlags } from "../../flags.js";

export default class ConfigIndex extends AblyBaseCommand {
  static override description = "Manage Ably CLI configuration";

  static override examples = [
    "<%= config.bin %> config path",
    "<%= config.bin %> config show",
  ];

  static override flags = {
    ...coreGlobalFlags,
  };

  async run(): Promise<void> {
    await this.config.runCommand("help", ["config"]);
  }
}
