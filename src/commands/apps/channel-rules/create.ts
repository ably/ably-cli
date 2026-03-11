import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { formatSuccess } from "../../../utils/output.js";

export default class ChannelRulesCreateCommand extends ControlBaseCommand {
  static description = "Create a channel rule";

  static examples = [
    '$ ably apps channel-rules create --name "chat" --persisted',
    '$ ably apps channel-rules create --name "events" --push-enabled',
    '$ ably apps channel-rules create --name "notifications" --persisted --push-enabled --app "My App"',
    '$ ably apps channel-rules create --name "chat" --persisted --json',
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
    "expose-time-serial": Flags.boolean({
      description:
        "Whether to expose the time serial for messages on channels matching this rule",
      required: false,
    }),
    name: Flags.string({
      description: "Name of the channel rule",
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
    const { flags } = await this.parse(ChannelRulesCreateCommand);

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const namespaceData = {
        authenticated: flags.authenticated,
        batchingEnabled: flags["batching-enabled"],
        batchingInterval: flags["batching-interval"],
        id: flags.name,
        conflationEnabled: flags["conflation-enabled"],
        conflationInterval: flags["conflation-interval"],
        conflationKey: flags["conflation-key"],
        exposeTimeSerial: flags["expose-time-serial"],
        persistLast: flags["persist-last"],
        persisted: flags.persisted,
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
              authenticated: createdNamespace.authenticated,
              batchingEnabled: createdNamespace.batchingEnabled,
              batchingInterval: createdNamespace.batchingInterval,
              conflationEnabled: createdNamespace.conflationEnabled,
              conflationInterval: createdNamespace.conflationInterval,
              conflationKey: createdNamespace.conflationKey,
              created: new Date(createdNamespace.created).toISOString(),
              exposeTimeSerial: createdNamespace.exposeTimeSerial,
              id: createdNamespace.id,
              name: flags.name,
              persistLast: createdNamespace.persistLast,
              persisted: createdNamespace.persisted,
              populateChannelRegistry: createdNamespace.populateChannelRegistry,
              pushEnabled: createdNamespace.pushEnabled,
              tlsOnly: createdNamespace.tlsOnly,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      } else {
        this.log(formatSuccess("Channel rule created."));
        this.log(`ID: ${createdNamespace.id}`);
        for (const line of formatChannelRuleDetails(createdNamespace, {
          formatDate: (t) => this.formatDate(t),
        })) {
          this.log(line);
        }
      }
    } catch (error) {
      this.fail(error, flags, "ChannelRuleCreate", { appId });
    }
  }
}
