import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

export default class QueuesDeleteCommand extends ControlBaseCommand {
  static args = {
    queueId: Args.string({
      description: "ID of the queue to delete",
      required: true,
    }),
  };

  static description = "Delete a queue";

  static examples = [
    "$ ably queues delete appAbc:us-east-1-a:foo",
    '$ ably queues delete appAbc:us-east-1-a:foo --app "My App"',
    "$ ably queues delete appAbc:us-east-1-a:foo --force",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to delete the queue from",
      required: false,
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Force deletion without confirmation",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(QueuesDeleteCommand);

    const controlApi = this.createControlApi(flags);

    try {
      // Get app ID from flags or config
      const appId = await this.resolveAppId(flags);

      if (!appId) {
        this.error(
          'No app specified. Use --app flag or select an app with "ably apps switch"',
        );
        return;
      }

      // Get all queues and find the one we want to delete by ID
      const queues = await controlApi.listQueues(appId);
      const queue = queues.find((q) => q.id === args.queueId);

      if (!queue) {
        this.error(`Queue with ID "${args.queueId}" not found`);
        return;
      }

      // If not using force flag, prompt for confirmation
      if (!flags.force) {
        this.log(`\nYou are about to delete the following queue:`);
        this.log(`Queue ID: ${queue.id}`);
        this.log(`Name: ${queue.name}`);
        this.log(`Region: ${queue.region}`);
        this.log(`State: ${queue.state}`);
        this.log(
          `Messages: ${queue.messages.total} total (${queue.messages.ready} ready, ${queue.messages.unacknowledged} unacknowledged)`,
        );

        const confirmed = await promptForConfirmation(
          `\nAre you sure you want to delete queue "${queue.name}"?`,
        );

        if (!confirmed) {
          this.log("Deletion cancelled");
          return;
        }
      }

      await controlApi.deleteQueue(appId, queue.id);

      this.log(`Queue "${queue.name}" (ID: ${queue.id}) deleted successfully`);
    } catch (error) {
      this.error(
        `Error deleting queue: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
