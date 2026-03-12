import { Command } from "@oclif/core";

import RulesUpdate from "../apps/rules/update.js";

export default class ChannelRuleUpdate extends Command {
  static override args = RulesUpdate.args;
  static override description = 'Alias for "ably apps rules update"';
  static override flags = RulesUpdate.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    const command = new RulesUpdate(this.argv, this.config);
    await command.run();
  }
}
