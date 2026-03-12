import { Command } from "@oclif/core";

import RulesCreate from "../apps/rules/create.js";

export default class ChannelRuleCreate extends Command {
  static override args = RulesCreate.args;
  static override description = 'Alias for "ably apps rules create"';
  static override flags = RulesCreate.flags;
  static override hidden = true;
  static isAlias = true;

  async run(): Promise<void> {
    const command = new RulesCreate(this.argv, this.config);
    await command.run();
  }
}
