import { Command } from "@oclif/core";

import RulesList from "../rules/list.js";

export default class ChannelRulesListCommand extends Command {
  static override args = RulesList.args;
  static override description = 'Alias for "ably apps rules list"';
  static override flags = RulesList.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    this.warn(
      '"apps channel-rules list" is deprecated. Use "apps rules list" instead.',
    );
    const command = new RulesList(this.argv, this.config);
    await command.run();
  }
}
