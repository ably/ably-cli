import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

export default class RulesCreateCommand extends ControlBaseCommand {
  static description = "Create a rule";

  static examples = [
    '$ ably apps rules create --name "chat" --persisted',
    '$ ably apps rules create --name "chat" --mutable-messages',
    '$ ably apps rules create --name "events" --push-enabled',
    '$ ably apps rules create --name "notifications" --persisted --push-enabled --app "My App"',
    '$ ably apps rules create --name "chat" --persisted --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    authenticated: Flags.boolean({
      description:
        "Whether channels matching this rule require clients to be authenticated",
      required: false,
    }),
    "batching-enabled": Flags.boolean({
      description:
        "Whether to enable batching for messages on channels matching this rule",
      required: false,
    }),
    "batching-interval": Flags.integer({
      description:
        "The batching interval for messages on channels matching this rule",
      required: false,
    }),
    "conflation-enabled": Flags.boolean({
      description:
        "Whether to enable conflation for messages on channels matching this rule",
      required: false,
    }),
    "conflation-interval": Flags.integer({
      description:
        "The conflation interval for messages on channels matching this rule",
      required: false,
    }),
    "conflation-key": Flags.string({
      description:
        "The conflation key for messages on channels matching this rule",
      required: false,
    }),
    "mutable-messages": Flags.boolean({
      description:
        "Whether messages on channels matching this rule can be updated or deleted after publishing. Automatically enables message persistence.",
      required: false,
    }),
    name: Flags.string({
      description: "Name of the rule",
      required: true,
    }),
    "persist-last": Flags.boolean({
      description:
        "Whether to persist only the last message on channels matching this rule",
      required: false,
    }),
    persisted: Flags.boolean({
      default: false,
      description:
        "Whether messages on channels matching this rule should be persisted",
      required: false,
    }),
    "populate-channel-registry": Flags.boolean({
      description:
        "Whether to populate the channel registry for channels matching this rule",
      required: false,
    }),
    "push-enabled": Flags.boolean({
      default: false,
      description:
        "Whether push notifications should be enabled for channels matching this rule",
      required: false,
    }),
    "tls-only": Flags.boolean({
      description: "Whether to enforce TLS for channels matching this rule",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RulesCreateCommand);

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);

      // When mutableMessages is enabled, persisted must also be enabled
      const mutableMessages = flags["mutable-messages"];
      let persisted = flags.persisted;

      if (mutableMessages) {
        persisted = true;
        this.logWarning(
          "Message persistence is automatically enabled when mutable messages is enabled.",
          flags,
        );
      }

      const namespaceData = {
        authenticated: flags.authenticated,
        batchingEnabled: flags["batching-enabled"],
        batchingInterval: flags["batching-interval"],
        id: flags.name,
        conflationEnabled: flags["conflation-enabled"],
        conflationInterval: flags["conflation-interval"],
        conflationKey: flags["conflation-key"],
        mutableMessages,
        persistLast: flags["persist-last"],
        persisted,
        populateChannelRegistry: flags["populate-channel-registry"],
        pushEnabled: flags["push-enabled"],
        tlsOnly: flags["tls-only"],
      };

      const createdNamespace = await controlApi.createNamespace(
        appId,
        namespaceData,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            appId,
            rule: {
              authenticated: createdNamespace.authenticated || false,
              batchingEnabled: createdNamespace.batchingEnabled || false,
              batchingInterval: createdNamespace.batchingInterval ?? null,
              conflationEnabled: createdNamespace.conflationEnabled || false,
              conflationInterval: createdNamespace.conflationInterval ?? null,
              conflationKey: createdNamespace.conflationKey ?? null,
              created: new Date(createdNamespace.created).toISOString(),
              id: createdNamespace.id,
              modified: new Date(createdNamespace.modified).toISOString(),
              mutableMessages: createdNamespace.mutableMessages || false,
              persistLast: createdNamespace.persistLast || false,
              persisted: createdNamespace.persisted || false,
              populateChannelRegistry:
                createdNamespace.populateChannelRegistry || false,
              pushEnabled: createdNamespace.pushEnabled || false,
              tlsOnly: createdNamespace.tlsOnly || false,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      } else {
        this.log(`${formatLabel("ID")} ${formatResource(createdNamespace.id)}`);
        for (const line of formatChannelRuleDetails(createdNamespace, {
          bold: true,
          formatDate: (t) => this.formatDate(t),
        })) {
          this.log(line);
        }
      }

      this.logSuccessMessage(
        "Channel rule " + formatResource(createdNamespace.id) + " created.",
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "ruleCreate", { appId });
    }
  }
}
