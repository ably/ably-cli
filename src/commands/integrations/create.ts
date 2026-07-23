import { Flags, Interfaces } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import type { RuleData } from "../../services/control-api.js";
import { formatLabel, formatResource } from "../../utils/output.js";

type FailFn = (message: string) => never;
type CreateFlags = Interfaces.InferredFlags<
  typeof IntegrationsCreateCommand.flags
>;

// Parses repeatable "key=value" threshold flags into a numeric map, e.g.
// ["bullying=2", "hate=1"] -> { bullying: 2, hate: 1 }. Rejects entries
// with a missing/blank/whitespace-only value or more than one "=" rather
// than silently coercing them — Number() trims and parses "" and " " as 0.
function parseThresholds(
  entries: string[] | undefined,
  fail: FailFn,
): Record<string, number> {
  const thresholds: Record<string, number> = {};
  for (const entry of entries ?? []) {
    const parts = entry.split("=");
    const [key, rawValue] = parts;
    const trimmedValue = rawValue?.trim();
    if (
      parts.length !== 2 ||
      !key ||
      !trimmedValue ||
      Number.isNaN(Number(trimmedValue))
    ) {
      fail(`Invalid --threshold value "${entry}". Expected format: key=number`);
    }

    thresholds[key] = Number(trimmedValue);
  }

  return thresholds;
}

// Shared base for the moderation-vendor target shapes (hive/text-model-only,
// tisane/text-moderation, azure/text-moderation), which all require an API
// key and numeric thresholds, plus their own vendor-specific fields on top.
function buildModerationTarget(
  flags: CreateFlags,
  fail: FailFn,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    apiKey: flags["target-api-key"],
    thresholds: parseThresholds(flags.threshold, fail),
    ...extra,
  };
}

// Joins flag names into a human-readable "required" message, e.g.
// ["a"] -> "--a", ["a", "b"] -> "--a and --b",
// ["a", "b", "c"] -> "--a, --b, and --c"
function joinRequiredFlags(names: string[]): string {
  const flagNames = names.map((name) => `--${name}`);
  if (flagNames.length <= 2) return flagNames.join(" and ");
  return `${flagNames.slice(0, -1).join(", ")}, and ${flagNames.at(-1)}`;
}

// Chat-sourced rule types use a structurally different schema from the
// classic Reactor-style channel rules (http, amqp, kinesis, etc.):
// invocationMode + beforePublishConfig instead of requestMode, and each has
// its own vendor-specific target shape. This table is the single source of
// truth for that shape — required target flags, the target payload builder,
// and the invocation mode — so a new chat rule type only needs one entry
// here plus a matching --rule-type option, rather than edits scattered
// across parallel lists and a switch statement.
interface ChatRuleTypeConfig {
  buildTarget: (flags: CreateFlags, fail: FailFn) => Record<string, unknown>;
  invocationMode: "AFTER_PUBLISH" | "BEFORE_PUBLISH";
  requiredTargetFlags: string[];
}

const CHAT_RULE_TYPES: Record<string, ChatRuleTypeConfig> = {
  "aws/lambda/before-publish": {
    buildTarget: (flags) => ({
      authentication: {
        accessKeyId: flags["target-access-key-id"],
        authenticationMode: "credentials",
        secretAccessKey: flags["target-secret-access-key"],
      },
      functionName: flags["target-function-name"],
      region: flags["target-region"],
    }),
    invocationMode: "BEFORE_PUBLISH",
    requiredTargetFlags: [
      "target-function-name",
      "target-region",
      "target-access-key-id",
      "target-secret-access-key",
    ],
  },
  "azure/text-moderation": {
    buildTarget: (flags, fail) =>
      buildModerationTarget(flags, fail, {
        endpoint: flags["target-endpoint"],
      }),
    invocationMode: "BEFORE_PUBLISH",
    requiredTargetFlags: ["target-api-key", "target-endpoint"],
  },
  "bodyguard/text-moderation": {
    buildTarget: (flags) => ({
      apiKey: flags["target-api-key"],
      channelId: flags["target-channel-id"],
    }),
    invocationMode: "BEFORE_PUBLISH",
    requiredTargetFlags: ["target-api-key", "target-channel-id"],
  },
  "hive/dashboard": {
    buildTarget: (flags) => ({
      apiKey: flags["target-api-key"],
    }),
    invocationMode: "AFTER_PUBLISH",
    requiredTargetFlags: ["target-api-key"],
  },
  "hive/text-model-only": {
    buildTarget: (flags, fail) =>
      buildModerationTarget(
        flags,
        fail,
        flags["target-model-url"]
          ? { modelUrl: flags["target-model-url"] }
          : {},
      ),
    invocationMode: "BEFORE_PUBLISH",
    requiredTargetFlags: ["target-api-key"],
  },
  "http/before-publish": {
    buildTarget: (flags) => ({ url: flags["target-url"] }),
    invocationMode: "BEFORE_PUBLISH",
    requiredTargetFlags: ["target-url"],
  },
  "tisane/text-moderation": {
    buildTarget: (flags, fail) =>
      buildModerationTarget(flags, fail, {
        ...(flags["default-language"] && {
          defaultLanguage: flags["default-language"],
        }),
        ...(flags["target-model-url"] && {
          modelUrl: flags["target-model-url"],
        }),
      }),
    invocationMode: "BEFORE_PUBLISH",
    requiredTargetFlags: ["target-api-key"],
  },
};

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
    const chatRuleConfig = CHAT_RULE_TYPES[ruleType];
    const fail: FailFn = (message) =>
      this.fail(message, flags, "integrationCreate");

    if (chatRuleConfig && flags["source-type"] !== "chat.message") {
      fail(`--source-type must be "chat.message" for ${ruleType} integrations`);
    }

    if (!chatRuleConfig && flags["source-type"] === "chat.message") {
      fail(
        `--source-type "chat.message" requires a chat rule type (e.g. --rule-type "http/before-publish"); "${ruleType}" is a channel-sourced rule type`,
      );
    }

    try {
      const controlApi = this.createControlApi(flags);
      // Prepare integration data
      const integrationData: RuleData = {
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

      if (chatRuleConfig) {
        integrationData.invocationMode = chatRuleConfig.invocationMode;

        if (chatRuleConfig.invocationMode === "BEFORE_PUBLISH") {
          integrationData.beforePublishConfig = {
            failedAction: flags["failed-action"],
            maxRetries: flags["max-retries"],
            retryTimeout: flags["retry-timeout"],
            tooManyRequestsAction: flags["too-many-requests-action"],
          };
        }

        const missingFlags = chatRuleConfig.requiredTargetFlags.filter(
          (flagName) => !flags[flagName as keyof CreateFlags],
        );
        if (missingFlags.length > 0) {
          fail(
            `${joinRequiredFlags(missingFlags)} ${missingFlags.length > 1 ? "are" : "is"} required for ${ruleType} integrations`,
          );
        }

        integrationData.target = chatRuleConfig.buildTarget(flags, fail);
      } else {
        integrationData.requestMode = flags["request-mode"];

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

          default: {
            this.logWarning(
              `Using default target for ${ruleType}. In a real implementation, more target options would be required.`,
              flags,
            );
            integrationData.target = { enveloped: true, format: "json" };
          }
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
