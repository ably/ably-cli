import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import {
  formatLabel,
  formatResource,
  formatSuccess,
} from "../../utils/output.js";

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
    '$ ably integrations create --rule-type "http" --source-type "channel.message" --target-url "https://example.com/webhook" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
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

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
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
            this.fail(
              "--target-url is required for HTTP integrations",
              flags,
              "IntegrationCreate",
            );
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
        this.logJsonResult({ integration: createdIntegration }, flags);
      } else {
        this.log(
          formatSuccess(
            `Integration rule created: ${formatResource(createdIntegration.id)}.`,
          ),
        );
        this.log(`${formatLabel("ID")} ${createdIntegration.id}`);
        this.log(`${formatLabel("App ID")} ${createdIntegration.appId}`);
        this.log(`${formatLabel("Type")} ${createdIntegration.ruleType}`);
        this.log(
          `${formatLabel("Request Mode")} ${createdIntegration.requestMode}`,
        );
        this.log(
          `${formatLabel("Source Channel Filter")} ${createdIntegration.source.channelFilter}`,
        );
        this.log(
          `${formatLabel("Source Type")} ${createdIntegration.source.type}`,
        );
        this.log(
          `${formatLabel("Target")} ${this.formatJsonOutput(createdIntegration.target as Record<string, unknown>, flags)}`,
        );
      }
    } catch (error) {
      this.fail(error, flags, "IntegrationCreate");
    }
  }
}
