import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";

// Interface for basic integration data structure
interface IntegrationData {
  requestMode: string;
  ruleType: string; // API property name
  source: {
    channelFilter: string;
    type: string;
  };
  status: "disabled" | "enabled";
  target: Record<string, unknown>; // Target is highly variable
}

export default class IntegrationsCreateCommand extends ControlBaseCommand {
  static description = "Create an integration";

  static examples = [
    '$ ably integrations create --rule-type "http" --source-type "channel.message" --target-url "https://example.com/webhook"',
    '$ ably integrations create --rule-type "amqp" --source-type "channel.message" --channel-filter "chat:*"',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to create the integration in",
      required: false,
    }),
    "channel-filter": Flags.string({
      description: "Channel filter pattern",
      required: false,
    }),
    "request-mode": Flags.string({
      default: "single",
      description: "Request mode for the integration (default: single)",
      options: ["single", "batch"],
      required: false,
    }),
    "rule-type": Flags.string({
      description: "Type of integration (http, amqp, etc.)",
      options: [
        "http",
        "amqp",
        "kinesis",
        "firehose",
        "pulsar",
        "kafka",
        "azure",
        "azure-functions",
        "mqtt",
        "cloudmqtt",
      ],
      required: true,
    }),
    "source-type": Flags.string({
      description: "The event source type",
      options: [
        "channel.message",
        "channel.presence",
        "channel.lifecycle",
        "presence.message",
      ],
      required: true,
    }),
    status: Flags.string({
      default: "enabled",
      description: "Initial status of the integration (default: enabled)",
      options: ["enabled", "disabled"],
      required: false,
    }),
    "target-url": Flags.string({
      description: "Target URL for HTTP integrations",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(IntegrationsCreateCommand);

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

      // Prepare integration data
      const integrationData: IntegrationData = {
        requestMode: flags["request-mode"] as string,
        ruleType: flags["rule-type"] as string, // API property name
        source: {
          channelFilter: flags["channel-filter"] || "",
          type: flags["source-type"],
        },
        status: flags.status === "enabled" ? "enabled" : "disabled",
        target: {},
      };

      // Add target data based on integration type
      switch (flags["rule-type"]) {
        case "http": {
          if (!flags["target-url"]) {
            this.error("--target-url is required for HTTP integrations");
            return;
          }

          integrationData.target = {
            enveloped: true,
            format: "json",
            url: flags["target-url"],
          };
          break;
        }

        case "amqp": {
          // Simplified AMQP config for demo purposes
          integrationData.target = {
            enveloped: true,
            exchangeName: "ably",
            format: "json",
            headers: {},
            immediate: false,
            mandatory: true,
            persistent: true,
            queueType: "classic",
            routingKey: "events",
          };
          break;
        }

        default: {
          this.log(
            `Note: Using default target for ${flags["rule-type"]}. In a real implementation, more target options would be required.`,
          );
          integrationData.target = { enveloped: true, format: "json" };
        }
      }

      const createdIntegration = await controlApi.createRule(
        appId,
        integrationData,
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput({ integration: createdIntegration }, flags),
        );
      } else {
        this.log(chalk.green("✓ Integration created successfully!"));
        this.log(`ID: ${createdIntegration.id}`);
        this.log(`App ID: ${createdIntegration.appId}`);
        this.log(`Type: ${createdIntegration.ruleType}`);
        this.log(`Request Mode: ${createdIntegration.requestMode}`);
        this.log(
          `Source Channel Filter: ${createdIntegration.source.channelFilter}`,
        );
        this.log(`Source Type: ${createdIntegration.source.type}`);
        this.log(
          `Target: ${this.formatJsonOutput(createdIntegration.target as Record<string, unknown>, flags)}`,
        );
      }
    } catch (error) {
      this.error(
        `Error creating integration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
