import { Command } from "@oclif/core";

import RulesList from "../apps/rules/list.js";

export default class ChannelRuleList extends Command {
  static override args = RulesList.args;
  static override description = 'Alias for "ably apps rules list"';
  static override flags = RulesList.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    const command = new RulesList(this.argv, this.config);
    await command.run();
  }
}
