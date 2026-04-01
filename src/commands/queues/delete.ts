import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { forceFlag } from "../../flags.js";
import { formatLabel, formatResource } from "../../utils/output.js";
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
    "$ ably queues delete appAbc:us-east-1-a:foo --json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(QueuesDeleteCommand);
    if (!args.queueId.trim()) {
      this.fail("Queue ID cannot be empty", flags, "parse");
    }

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      // Get all queues and find the one we want to delete by ID
      const queues = await controlApi.listQueues(appId);
      const queue = queues.find((q) => q.id === args.queueId);

      if (!queue) {
        this.fail(
          `Queue with ID "${args.queueId}" not found`,
          flags,
          "queueDelete",
        );
      }

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm deletion",
          flags,
          "queueDelete",
        );
      }

      // If not using force flag, prompt for confirmation
      if (!flags.force && !this.shouldOutputJson(flags)) {
        this.log(`\nYou are about to delete the following queue:`);
        this.log(`${formatLabel("Queue ID")} ${queue.id}`);
        this.log(`${formatLabel("Name")} ${queue.name}`);
        this.log(`${formatLabel("Region")} ${queue.region}`);
        this.log(`${formatLabel("State")} ${queue.state}`);
        this.log(
          `Messages: ${queue.messages.total} total (${queue.messages.ready} ready, ${queue.messages.unacknowledged} unacknowledged)`,
        );

        const confirmed = await promptForConfirmation(
          `\nAre you sure you want to delete queue "${queue.name}"?`,
        );

        if (!confirmed) {
          this.logWarning("Deletion cancelled.", flags);
          return;
        }
      }

      await controlApi.deleteQueue(appId, queue.id);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            queue: {
              id: queue.id,
              name: queue.name,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      }

      this.logSuccessMessage(
        `Queue deleted: ${formatResource(queue.name)} (${queue.id}).`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "queueDelete");
    }
  }
}
