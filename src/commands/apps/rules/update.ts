import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

export default class RulesUpdateCommand extends ControlBaseCommand {
  static args = {
    nameOrId: Args.string({
      description: "Name or ID of the rule to update",
      required: true,
    }),
  };

  static description = "Update a rule";

  static examples = [
    "$ ably apps rules update chat --persisted",
    "$ ably apps rules update chat --mutable-messages",
    "$ ably apps rules update events --push-enabled=false",
    '$ ably apps rules update notifications --persisted --push-enabled --app "My App"',
    "$ ably apps rules update chat --persisted --json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      required: false,
    }),
    authenticated: Flags.boolean({
      allowNo: true,
      description:
        "Whether channels matching this rule require clients to be authenticated",
      required: false,
    }),
    "batching-enabled": Flags.boolean({
      allowNo: true,
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
      allowNo: true,
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
      allowNo: true,
      description:
        "Whether messages on channels matching this rule can be updated or deleted after publishing. Automatically enables message persistence.",
      required: false,
    }),
    "persist-last": Flags.boolean({
      allowNo: true,
      description:
        "Whether to persist only the last message on channels matching this rule",
      required: false,
    }),
    persisted: Flags.boolean({
      allowNo: true,
      description:
        "Whether messages on channels matching this rule should be persisted",
      required: false,
    }),
    "populate-channel-registry": Flags.boolean({
      allowNo: true,
      description:
        "Whether to populate the channel registry for channels matching this rule",
      required: false,
    }),
    "push-enabled": Flags.boolean({
      allowNo: true,
      description:
        "Whether push notifications should be enabled for channels matching this rule",
      required: false,
    }),
    "tls-only": Flags.boolean({
      allowNo: true,
      description: "Whether to enforce TLS for channels matching this rule",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags: rawFlags } = await this.parse(RulesUpdateCommand);

    // allowNo flags are typed as `boolean` by oclif but are actually `boolean | undefined` at runtime
    type AllowNoFlags =
      | "authenticated"
      | "batching-enabled"
      | "conflation-enabled"
      | "mutable-messages"
      | "persist-last"
      | "persisted"
      | "populate-channel-registry"
      | "push-enabled"
      | "tls-only";
    const flags = rawFlags as Omit<typeof rawFlags, AllowNoFlags> &
      Record<AllowNoFlags, boolean | undefined>;

    const appId = await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      // Find the namespace by name or ID
      const namespaces = await controlApi.listNamespaces(appId);
      const namespace = namespaces.find((n) => n.id === args.nameOrId);

      if (!namespace) {
        this.fail(`Rule "${args.nameOrId}" not found`, flags, "ruleUpdate", {
          appId,
        });
      }

      // Prepare update data
      const updateData: Record<string, boolean | number | string | undefined> =
        {};

      // Validation for mutable-messages flag, checks with supplied/existing mutableMessages flag
      if (
        flags.persisted === false &&
        (flags["mutable-messages"] === true ||
          (flags["mutable-messages"] === undefined &&
            namespace.mutableMessages))
      ) {
        this.fail(
          "Cannot disable persistence when mutable messages is enabled. Mutable messages requires message persistence.",
          flags,
          "ruleUpdate",
          { appId, ruleId: namespace.id },
        );
      }

      if (flags.persisted !== undefined) {
        updateData.persisted = flags.persisted;
      }

      if (flags["mutable-messages"] !== undefined) {
        updateData.mutableMessages = flags["mutable-messages"];
        if (flags["mutable-messages"]) {
          updateData.persisted = true;
          this.logWarning(
            "Message persistence is automatically enabled when mutable messages is enabled.",
            flags,
          );
        }
      }

      if (flags["push-enabled"] !== undefined) {
        updateData.pushEnabled = flags["push-enabled"];
      }

      if (flags.authenticated !== undefined) {
        updateData.authenticated = flags.authenticated;
      }

      if (flags["persist-last"] !== undefined) {
        updateData.persistLast = flags["persist-last"];
      }

      if (flags["populate-channel-registry"] !== undefined) {
        updateData.populateChannelRegistry = flags["populate-channel-registry"];
      }

      if (flags["batching-enabled"] !== undefined) {
        updateData.batchingEnabled = flags["batching-enabled"];
      }

      if (flags["batching-interval"] !== undefined) {
        updateData.batchingInterval = flags["batching-interval"] as number;
      }

      if (flags["conflation-enabled"] !== undefined) {
        updateData.conflationEnabled = flags["conflation-enabled"];
      }

      if (flags["conflation-interval"] !== undefined) {
        updateData.conflationInterval = flags["conflation-interval"] as number;
      }

      if (flags["conflation-key"] !== undefined) {
        updateData.conflationKey = flags["conflation-key"] as string;
      }

      if (flags["tls-only"] !== undefined) {
        updateData.tlsOnly = flags["tls-only"];
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        this.fail(
          "No update parameters provided. Use one of the flag options to update the rule.",
          flags,
          "ruleUpdate",
          { appId, ruleId: namespace.id },
        );
      }

      const updatedNamespace = await controlApi.updateNamespace(
        appId,
        namespace.id,
        updateData,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            appId,
            rule: {
              authenticated: updatedNamespace.authenticated || false,
              batchingEnabled: updatedNamespace.batchingEnabled || false,
              batchingInterval: updatedNamespace.batchingInterval ?? null,
              conflationEnabled: updatedNamespace.conflationEnabled || false,
              conflationInterval: updatedNamespace.conflationInterval ?? null,
              conflationKey: updatedNamespace.conflationKey ?? null,
              created: new Date(updatedNamespace.created).toISOString(),
              id: updatedNamespace.id,
              modified: new Date(updatedNamespace.modified).toISOString(),
              mutableMessages: updatedNamespace.mutableMessages || false,
              persistLast: updatedNamespace.persistLast || false,
              persisted: updatedNamespace.persisted || false,
              populateChannelRegistry:
                updatedNamespace.populateChannelRegistry || false,
              pushEnabled: updatedNamespace.pushEnabled || false,
              tlsOnly: updatedNamespace.tlsOnly || false,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      } else {
        this.log(`${formatLabel("ID")} ${formatResource(updatedNamespace.id)}`);
        for (const line of formatChannelRuleDetails(updatedNamespace, {
          bold: true,
          formatDate: (t) => this.formatDate(t),
          showTimestamps: true,
        })) {
          this.log(line);
        }
      }

      this.logSuccessMessage(
        `Channel rule ${formatResource(updatedNamespace.id)} updated.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "ruleUpdate", { appId });
    }
  }
}
