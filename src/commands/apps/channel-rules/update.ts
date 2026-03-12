import { Command } from "@oclif/core";

import RulesUpdate from "../rules/update.js";

export default class ChannelRulesUpdateCommand extends Command {
  static override args = RulesUpdate.args;
  static override description = 'Alias for "ably apps rules update"';
  static override flags = RulesUpdate.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    this.warn(
      '"apps channel-rules update" is deprecated. Use "apps rules update" instead.',
    );
    const command = new RulesUpdate(this.argv, this.config);
    await command.run();
  }
}
