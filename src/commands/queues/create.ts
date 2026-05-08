import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatLabel, formatResource } from "../../utils/output.js";

export default class QueuesCreateCommand extends ControlBaseCommand {
  static description = "Create a queue";

  static args = {
    queueName: Args.string({
      description: "Name of the queue",
      required: true,
    }),
  };

  static examples = [
    '$ ably queues create "my-queue"',
    '$ ably queues create "my-queue" --ttl 300 --max-length 5000',
    '$ ably queues create "my-queue" --region "eu-west-1-a" --app "My App"',
    '$ ably queues create "my-queue" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    "max-length": Flags.integer({
      default: 10_000,
      description: "Maximum number of messages in the queue (max: 10000)",
      required: false,
    }),
    region: Flags.string({
      default: "us-east-1-a",
      description: "Region for the queue (e.g., us-east-1-a, eu-west-1-a)",
      required: false,
    }),
    ttl: Flags.integer({
      default: 60,
      description: "Time to live for messages in seconds (max: 3600)",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(QueuesCreateCommand);
    if (!args.queueName.trim()) {
      this.fail("Queue name cannot be empty", flags, "parse");
    }

    const appId = await this.requireAppId(flags);

    if (flags["max-length"] > 10_000) {
      this.fail("max-length must not exceed 10000.", flags, "queueCreate");
    }

    if (flags.ttl > 3600) {
      this.fail("ttl must not exceed 3600 seconds.", flags, "queueCreate");
    }

    try {
      const controlApi = this.createControlApi(flags);
      const queueData = {
        maxLength: flags["max-length"],
        name: args.queueName,
        region: flags.region,
        ttl: flags.ttl,
      };

      const createdQueue = await controlApi.createQueue(appId, queueData);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            queue: structuredClone(createdQueue),
          },
          flags,
        );
      } else {
        this.log(`${formatLabel("Queue ID")} ${createdQueue.id}`);
        this.log(`${formatLabel("Name")} ${createdQueue.name}`);
        this.log(`${formatLabel("Region")} ${createdQueue.region}`);
        this.log(`${formatLabel("TTL")} ${createdQueue.ttl} seconds`);
        this.log(
          `${formatLabel("Max Length")} ${createdQueue.maxLength} messages`,
        );
        this.log(`${formatLabel("State")} ${createdQueue.state}`);

        this.log(`\nAMQP Connection Details:`);
        this.log(`${formatLabel("URI")} ${createdQueue.amqp.uri}`);
        this.log(`${formatLabel("Queue Name")} ${createdQueue.amqp.queueName}`);

        this.log(`\nSTOMP Connection Details:`);
        this.log(`${formatLabel("URI")} ${createdQueue.stomp.uri}`);
        this.log(`${formatLabel("Host")} ${createdQueue.stomp.host}`);
        this.log(
          `${formatLabel("Destination")} ${createdQueue.stomp.destination}`,
        );
      }

      this.logSuccessMessage(
        `Queue created: ${formatResource(createdQueue.name)}.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "queueCreate");
    }
  }
}
