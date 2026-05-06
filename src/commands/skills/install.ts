import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../base-command.js";
import { coreGlobalFlags } from "../../flags.js";
import {
  runSkillsInstall,
  SkillsInstallOutput,
} from "../../services/skills-install-runner.js";
import { TARGET_CONFIGS } from "../../services/skills-installer.js";
import { BaseFlags } from "../../types/cli.js";

export default class SkillsInstall extends AblyBaseCommand {
  static override description =
    "Install Ably Agent Skills into AI coding tools";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = {
    ...coreGlobalFlags,
    target: Flags.string({
      char: "t",
      multiple: true,
      options: ["auto", ...Object.keys(TARGET_CONFIGS)],
      default: ["auto"],
      description: "Target IDE(s) to install skills for",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillsInstall);
    try {
      await runSkillsInstall(flags, this.buildInstallOutput(flags));
    } catch (error) {
      this.fail(error, flags, "skillsInstall");
    }
  }

  protected buildInstallOutput(flags: BaseFlags): SkillsInstallOutput {
    return {
      jsonMode: this.shouldOutputJson(flags),
      progress: (msg) => this.logProgress(msg, flags),
      success: (msg) => this.logSuccessMessage(msg, flags),
      warning: (msg) => this.logWarning(msg, flags),
      log: (msg) => this.log(msg),
      emitResult: (data) => this.logJsonResult(data, flags),
    };
  }
}
