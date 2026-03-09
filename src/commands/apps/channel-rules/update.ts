import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatChannelRuleDetails } from "../../../utils/channel-rule-display.js";
import { errorMessage } from "../../../utils/errors.js";

export default class ChannelRulesUpdateCommand extends ControlBaseCommand {
  static args = {
    nameOrId: Args.string({
      description: "Name or ID of the channel rule to update",
      required: true,
    }),
  };

  static description = "Update a channel rule";

  static examples = [
    "$ ably apps channel-rules update chat --persisted",
    "$ ably apps channel-rules update events --push-enabled=false",
    '$ ably apps channel-rules update notifications --persisted --push-enabled --app "My App"',
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
    "expose-time-serial": Flags.boolean({
      allowNo: true,
      description:
        "Whether to expose the time serial for messages on channels matching this rule",
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
    const { args, flags } = await this.parse(ChannelRulesUpdateCommand);

    const appId = await this.requireAppId(flags);
    if (!appId) return;

    const controlApi = this.createControlApi(flags);

    try {
      // Find the namespace by name or ID
      const namespaces = await controlApi.listNamespaces(appId);
      const namespace = namespaces.find((n) => n.id === args.nameOrId);

      if (!namespace) {
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            {
              appId,
              error: `Channel rule "${args.nameOrId}" not found`,
              status: "error",
              success: false,
            },
            flags,
          );
        } else {
          this.error(`Channel rule "${args.nameOrId}" not found`);
        }

        return;
      }

      // Prepare update data
      const updateData: Record<string, boolean | number | string | undefined> =
        {};

      if (flags.persisted !== undefined) {
        updateData.persisted = flags.persisted;
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

      if (flags["expose-time-serial"] !== undefined) {
        updateData.exposeTimeSerial = flags["expose-time-serial"];
      }

      if (flags["populate-channel-registry"] !== undefined) {
        updateData.populateChannelRegistry = flags["populate-channel-registry"];
      }

      if (flags["batching-enabled"] !== undefined) {
        updateData.batchingEnabled = flags["batching-enabled"];
      }

      if (flags["batching-interval"] !== undefined) {
        updateData.batchingInterval = flags["batching-interval"];
      }

      if (flags["conflation-enabled"] !== undefined) {
        updateData.conflationEnabled = flags["conflation-enabled"];
      }

      if (flags["conflation-interval"] !== undefined) {
        updateData.conflationInterval = flags["conflation-interval"];
      }

      if (flags["conflation-key"] !== undefined) {
        updateData.conflationKey = flags["conflation-key"];
      }

      if (flags["tls-only"] !== undefined) {
        updateData.tlsOnly = flags["tls-only"];
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        if (this.shouldOutputJson(flags)) {
          this.jsonError(
            {
              appId,
              error:
                "No update parameters provided. Use one of the flag options to update the channel rule.",
              ruleId: namespace.id,
              status: "error",
              success: false,
            },
            flags,
          );
        } else {
          this.error(
            "No update parameters provided. Use one of the flag options to update the channel rule.",
          );
        }

        return;
      }

      const updatedNamespace = await controlApi.updateNamespace(
        appId,
        namespace.id,
        updateData,
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              appId,
              rule: {
                authenticated: updatedNamespace.authenticated,
                batchingEnabled: updatedNamespace.batchingEnabled,
                batchingInterval: updatedNamespace.batchingInterval,
                conflationEnabled: updatedNamespace.conflationEnabled,
                conflationInterval: updatedNamespace.conflationInterval,
                conflationKey: updatedNamespace.conflationKey,
                created: new Date(updatedNamespace.created).toISOString(),
                exposeTimeSerial: updatedNamespace.exposeTimeSerial,
                id: updatedNamespace.id,
                modified: new Date(updatedNamespace.modified).toISOString(),
                persistLast: updatedNamespace.persistLast,
                persisted: updatedNamespace.persisted,
                populateChannelRegistry:
                  updatedNamespace.populateChannelRegistry,
                pushEnabled: updatedNamespace.pushEnabled,
                tlsOnly: updatedNamespace.tlsOnly,
              },
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log("Channel rule updated successfully:");
        this.log(`ID: ${updatedNamespace.id}`);
        for (const line of formatChannelRuleDetails(updatedNamespace, {
          formatDate: (t) => this.formatDate(t),
          showTimestamps: true,
        })) {
          this.log(line);
        }
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            appId,
            error: errorMessage(error),
            status: "error",
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error updating channel rule: ${errorMessage(error)}`);
      }
    }
  }
}
