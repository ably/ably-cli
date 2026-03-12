import { Command } from "@oclif/core";

import RulesIndex from "../rules/index.js";

export default class ChannelRulesIndexCommand extends Command {
  static override args = RulesIndex.args;
  static override description = 'Alias for "ably apps rules"';
  static override flags = RulesIndex.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    const command = new RulesIndex(this.argv, this.config);
    await command.run();
  }
}
