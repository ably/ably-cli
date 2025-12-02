import * as fs from "node:fs";
import * as toml from "toml";

import { AblyBaseCommand } from "../../base-command.js";

export default class ConfigShow extends AblyBaseCommand {
  static override description =
    "Display the contents of the Ably CLI config file";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConfigShow);

    const configPath = this.configManager.getConfigPath();

    if (!fs.existsSync(configPath)) {
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            { error: "Config file does not exist", path: configPath },
            flags,
          ),
        );
        this.exit(1);
        return; // Needed for test mode where exit() doesn't throw
      } else {
        this.error(
          `Config file does not exist at: ${configPath}\nRun "ably accounts login" to create one.`,
        );
      }
    }

    const contents = fs.readFileSync(configPath, "utf8");

    if (this.shouldOutputJson(flags)) {
      // Parse the TOML and output as JSON
      try {
        const config = toml.parse(contents);
        this.log(
          this.formatJsonOutput(
            { exists: true, path: configPath, config },
            flags,
          ),
        );
      } catch {
        // If parsing fails, just show raw contents
        this.log(
          this.formatJsonOutput(
            { exists: true, path: configPath, raw: contents },
            flags,
          ),
        );
      }
    } else {
      this.log(`# Config file: ${configPath}\n`);
      this.log(contents);
    }
  }
}
