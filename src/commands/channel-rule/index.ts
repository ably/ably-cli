import { Command } from "@oclif/core";

import RulesIndex from "../apps/rules/index.js";

export default class ChannelRule extends Command {
  static override args = RulesIndex.args;
  static override description = 'Alias for "ably apps rules"';
  static override flags = RulesIndex.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    this.warn('"channel-rule" is deprecated. Use "apps rules" instead.');
    const command = new RulesIndex(this.argv, this.config);
    await command.run();
  }
}
