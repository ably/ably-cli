import { Command } from "@oclif/core";

import RulesDelete from "../apps/rules/delete.js";

export default class ChannelRuleDelete extends Command {
  static override args = RulesDelete.args;
  static override description = 'Alias for "ably apps rules delete"';
  static override flags = RulesDelete.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    const command = new RulesDelete(this.argv, this.config);
    await command.run();
  }
}
