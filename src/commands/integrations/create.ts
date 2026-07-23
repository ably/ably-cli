import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatLabel, formatResource } from "../../utils/output.js";

// Rule types that are sourced from Ably Chat rooms and invoked either
// before or after a chat message is published, rather than the classic
// Reactor-style channel rules (http, amqp, kinesis, etc.).
const CHAT_RULE_TYPES = new Set([
  "hive/text-model-only",
  "hive/dashboard",
  "aws/lambda/before-publish",
  "http/before-publish",
  "bodyguard/text-moderation",
  "tisane/text-moderation",
  "azure/text-moderation",
]);

// The only chat rule type invoked after publish; every other chat rule
// type runs before publish and requires a beforePublishConfig.
const AFTER_PUBLISH_CHAT_RULE_TYPES = new Set(["hive/dashboard"]);

interface BeforePublishConfig {
  failedAction: string;
  maxRetries: number;
  retryTimeout: number;
  tooManyRequestsAction: string;
}

// Interface for basic integration data structure
interface IntegrationData {
  beforePublishConfig?: BeforePublishConfig;
  chatRoomFilter?: string;
  invocationMode?: string;
  requestMode?: string;
  ruleType: string; // API property name
  source: {
    channelFilter?: string;
    type: string;
  };
  status: "disabled" | "enabled";
  target: Record<string, unknown>; // Target is highly variable
}

// Parses repeatable "key=value" threshold flags into a numeric map, e.g.
// ["bullying=2", "sexual=1"] -> { bullying: 2, sexual: 1 }
function parseThresholds(
  entries: string[] | undefined,
  fail: (message: string) => never,
): Record<string, number> {
  const thresholds: Record<string, number> = {};
  for (const entry of entries ?? []) {
    const [key, rawValue] = entry.split("=");
    if (!key || rawValue === undefined || Number.isNaN(Number(rawValue))) {
      fail(`Invalid --threshold value "${entry}". Expected format: key=number`);
    }

    thresholds[key] = Number(rawValue);
  }

  return thresholds;
}

export default class IntegrationsCreateCommand extends ControlBaseCommand {
  static description = "Create an integration";

  static examples = [
    '$ ably integrations create --rule-type "http" --source-type "channel.message" --target-url "https://example.com/webhook"',
    '$ ably integrations create --rule-type "amqp" --source-type "channel.message" --channel-filter "chat:.*"',
    '$ ably integrations create --rule-type "http/before-publish" --source-type "chat.message" --chat-room-filter "room:.*" --target-url "https://example.com/webhook"',
    '$ ably integrations create --rule-type "tisane/text-moderation" --source-type "chat.message" --target-api-key "key" --threshold "profanity=1" --threshold "allegation=1"',
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
    "chat-room-filter": Flags.string({
      description: "Chat room filter pattern",
      required: false,
    }),
    "default-language": Flags.string({
      description:
        "Default language for text moderation (tisane/text-moderation)",
      required: false,
    }),
    "failed-action": Flags.string({
      default: "REJECT",
      description:
        "Action to take when the before-publish call fails after retries",
      required: false,
    }),
    "max-retries": Flags.integer({
      default: 3,
      description: "Maximum number of retries for a before-publish call",
      required: false,
    }),
    "request-mode": Flags.string({
      default: "single",
      description: "Request mode for the integration",
      options: ["single", "batch"],
      required: false,
    }),
    "retry-timeout": Flags.integer({
      default: 3000,
      description: "Retry timeout in milliseconds for a before-publish call",
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
        "http/before-publish",
        "hive/text-model-only",
        "hive/dashboard",
        "aws/lambda/before-publish",
        "bodyguard/text-moderation",
        "tisane/text-moderation",
        "azure/text-moderation",
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
        "chat.message",
      ],
      required: true,
    }),
    status: Flags.string({
      default: "enabled",
      description: "Initial status of the integration",
      options: ["enabled", "disabled"],
      required: false,
    }),
    "target-access-key-id": Flags.string({
      description: "AWS access key ID (aws/lambda/before-publish)",
      required: false,
    }),
    "target-api-key": Flags.string({
      description:
        "API key for the target service (moderation/dashboard rule types)",
      required: false,
    }),
    "target-channel-id": Flags.string({
      description:
        "Channel ID for the target service (bodyguard/text-moderation)",
      required: false,
    }),
    "target-endpoint": Flags.string({
      description:
        "Endpoint URL for the target service (azure/text-moderation)",
      required: false,
    }),
    "target-function-name": Flags.string({
      description: "AWS Lambda function name (aws/lambda/before-publish)",
      required: false,
    }),
    "target-model-url": Flags.string({
      description:
        "Custom model URL for the target service (hive/text-model-only, tisane/text-moderation)",
      required: false,
    }),
    "target-region": Flags.string({
      description: "AWS region (aws/lambda/before-publish)",
      required: false,
    }),
    "target-secret-access-key": Flags.string({
      description: "AWS secret access key (aws/lambda/before-publish)",
      required: false,
    }),
    "target-url": Flags.string({
      description: "Target URL for HTTP integrations",
      required: false,
    }),
    "too-many-requests-action": Flags.string({
      default: "RETRY",
      description:
        "Action to take when the target rate-limits a before-publish call",
      required: false,
    }),
    threshold: Flags.string({
      description:
        "Moderation threshold as key=value, repeatable (e.g. --threshold profanity=1)",
      multiple: true,
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(IntegrationsCreateCommand);

    const appId = await this.requireAppId(flags);
    const ruleType = flags["rule-type"];
    const fail = (message: string): never =>
      this.fail(message, flags, "integrationCreate");

    try {
      const controlApi = this.createControlApi(flags);
      // Prepare integration data
      const integrationData: IntegrationData = {
        ruleType, // API property name
        source: {
          type: flags["source-type"],
          // chat.message sources reject a channelFilter property outright,
          // even when empty, so it's only included for channel-based sources.
          ...(flags["source-type"] !== "chat.message" && {
            channelFilter: flags["channel-filter"] || "",
          }),
        },
        status: flags.status === "enabled" ? "enabled" : "disabled",
        target: {},
      };

      if (flags["chat-room-filter"]) {
        integrationData.chatRoomFilter = flags["chat-room-filter"];
      }

      if (CHAT_RULE_TYPES.has(ruleType)) {
        integrationData.invocationMode = AFTER_PUBLISH_CHAT_RULE_TYPES.has(
          ruleType,
        )
          ? "AFTER_PUBLISH"
          : "BEFORE_PUBLISH";

        if (integrationData.invocationMode === "BEFORE_PUBLISH") {
          integrationData.beforePublishConfig = {
            failedAction: flags["failed-action"],
            maxRetries: flags["max-retries"],
            retryTimeout: flags["retry-timeout"],
            tooManyRequestsAction: flags["too-many-requests-action"],
          };
        }
      } else {
        integrationData.requestMode = flags["request-mode"];
      }

      // Add target data based on integration type
      switch (ruleType) {
        case "http": {
          if (!flags["target-url"]) {
            fail("--target-url is required for HTTP integrations");
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

        case "http/before-publish": {
          if (!flags["target-url"]) {
            fail(
              "--target-url is required for http/before-publish integrations",
            );
          }

          integrationData.target = { url: flags["target-url"] };
          break;
        }

        case "hive/text-model-only": {
          if (!flags["target-api-key"]) {
            fail(
              "--target-api-key is required for hive/text-model-only integrations",
            );
          }

          integrationData.target = {
            apiKey: flags["target-api-key"],
            thresholds: parseThresholds(flags.threshold, fail),
            ...(flags["target-model-url"] && {
              modelUrl: flags["target-model-url"],
            }),
          };
          break;
        }

        case "hive/dashboard": {
          if (!flags["target-api-key"]) {
            fail(
              "--target-api-key is required for hive/dashboard integrations",
            );
          }

          integrationData.target = { apiKey: flags["target-api-key"] };
          break;
        }

        case "bodyguard/text-moderation": {
          if (!flags["target-api-key"] || !flags["target-channel-id"]) {
            fail(
              "--target-api-key and --target-channel-id are required for bodyguard/text-moderation integrations",
            );
          }

          integrationData.target = {
            apiKey: flags["target-api-key"],
            channelId: flags["target-channel-id"],
          };
          break;
        }

        case "tisane/text-moderation": {
          if (!flags["target-api-key"]) {
            fail(
              "--target-api-key is required for tisane/text-moderation integrations",
            );
          }

          integrationData.target = {
            apiKey: flags["target-api-key"],
            thresholds: parseThresholds(flags.threshold, fail),
            ...(flags["default-language"] && {
              defaultLanguage: flags["default-language"],
            }),
            ...(flags["target-model-url"] && {
              modelUrl: flags["target-model-url"],
            }),
          };
          break;
        }

        case "azure/text-moderation": {
          if (!flags["target-api-key"] || !flags["target-endpoint"]) {
            fail(
              "--target-api-key and --target-endpoint are required for azure/text-moderation integrations",
            );
          }

          integrationData.target = {
            apiKey: flags["target-api-key"],
            endpoint: flags["target-endpoint"],
            thresholds: parseThresholds(flags.threshold, fail),
          };
          break;
        }

        case "aws/lambda/before-publish": {
          if (
            !flags["target-function-name"] ||
            !flags["target-region"] ||
            !flags["target-access-key-id"] ||
            !flags["target-secret-access-key"]
          ) {
            fail(
              "--target-function-name, --target-region, --target-access-key-id, and --target-secret-access-key are required for aws/lambda/before-publish integrations",
            );
          }

          integrationData.target = {
            authentication: {
              accessKeyId: flags["target-access-key-id"],
              authenticationMode: "credentials",
              secretAccessKey: flags["target-secret-access-key"],
            },
            functionName: flags["target-function-name"],
            region: flags["target-region"],
          };
          break;
        }

        default: {
          this.logWarning(
            `Using default target for ${ruleType}. In a real implementation, more target options would be required.`,
            flags,
          );
          integrationData.target = { enveloped: true, format: "json" };
        }
      }

      const createdIntegration = await controlApi.createRule(
        appId,
        integrationData,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            integration: {
              ...createdIntegration,
              created: new Date(createdIntegration.created).toISOString(),
              modified: new Date(createdIntegration.modified).toISOString(),
            },
          },
          flags,
        );
      } else {
        this.log(`${formatLabel("ID")} ${createdIntegration.id}`);
        this.log(`${formatLabel("App ID")} ${createdIntegration.appId}`);
        this.log(`${formatLabel("Type")} ${createdIntegration.ruleType}`);
        if (createdIntegration.requestMode) {
          this.log(
            `${formatLabel("Request Mode")} ${createdIntegration.requestMode}`,
          );
        }

        if (createdIntegration.invocationMode) {
          this.log(
            `${formatLabel("Invocation Mode")} ${createdIntegration.invocationMode}`,
          );
        }

        if (createdIntegration.source.channelFilter) {
          this.log(
            `${formatLabel("Source Channel Filter")} ${createdIntegration.source.channelFilter}`,
          );
        }
        if (createdIntegration.chatRoomFilter) {
          this.log(
            `${formatLabel("Chat Room Filter")} ${createdIntegration.chatRoomFilter}`,
          );
        }
        this.log(
          `${formatLabel("Source Type")} ${createdIntegration.source.type}`,
        );
        this.log(
          `${formatLabel("Target")} ${this.formatJsonOutput(createdIntegration.target as Record<string, unknown>, flags)}`,
        );
      }

      this.logSuccessMessage(
        `Integration rule created: ${formatResource(createdIntegration.id)}.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "integrationCreate");
    }
  }
}
