import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import {
  clientIdFlag,
  durationFlag,
  productApiFlags,
  rewindFlag,
} from "../../../flags.js";
import {
  formatAnnotationsOutput,
  formatListening,
  formatMessageTimestamp,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";
import type { AnnotationDisplayFields } from "../../../utils/output.js";

export default class ChannelsAnnotationsSubscribe extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name to subscribe to annotations on",
      required: true,
    }),
  };

  static override description = "Subscribe to annotations on an Ably channel";

  static override examples = [
    "$ ably channels annotations subscribe my-channel",
    '$ ably channels annotations subscribe my-channel --type "reactions:flag.v1"',
    '$ ably channels annotations subscribe my-channel --type "metrics:total.v1"',
    "$ ably channels annotations subscribe my-channel --duration 30",
    "$ ably channels annotations subscribe my-channel --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
    ...rewindFlag,
    type: Flags.string({
      description: "Filter annotations by type",
    }),
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsSubscribe);
    const channelName = args.channel;

    try {
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;

      const channelOptions: Ably.ChannelOptions = {
        modes: ["ANNOTATION_SUBSCRIBE"],
      };

      this.configureRewind(
        channelOptions,
        flags.rewind,
        flags,
        "annotationSubscribe",
        channelName,
      );

      const channel = client.channels.get(channelName, channelOptions);

      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });

      this.logCliEvent(
        flags,
        "annotationSubscribe",
        "subscribing",
        `Subscribing to annotations on channel: ${channelName}`,
        { channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Attaching to channel: ${formatResource(channelName)}`,
          ),
        );
      }

      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      const attachPromise = new Promise<void>((resolve) => {
        const checkAttached = () => {
          if (channel.state === "attached") {
            resolve();
          }
        };
        channel.once("attached", checkAttached);
        checkAttached();
      });

      const callback = (annotation: Ably.Annotation) => {
        const timestamp =
          annotation.timestamp !== undefined && annotation.timestamp !== null
            ? formatMessageTimestamp(annotation.timestamp)
            : "[Unknown timestamp]";
        const annotationData = {
          id: annotation.id,
          timestamp,
          channel: channelName,
          annotationType: annotation.type,
          action: annotation.action,
          name: annotation.name,
          clientId: annotation.clientId,
          count: annotation.count,
          serial: annotation.serial,
          data: annotation.data,
        };

        this.logCliEvent(
          flags,
          "annotationSubscribe",
          "annotationReceived",
          `Received annotation on channel ${channelName}`,
          annotationData,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ annotation: annotationData }, flags);
        } else {
          const displayFields: AnnotationDisplayFields = {
            id: annotation.id,
            timestamp: annotation.timestamp ?? Date.now(),
            channel: channelName,
            type: annotation.type,
            action:
              annotation.action === undefined
                ? undefined
                : String(annotation.action),
            name: annotation.name,
            clientId: annotation.clientId,
            count: annotation.count,
            serial: annotation.serial,
            data: annotation.data,
          };
          this.log(formatAnnotationsOutput([displayFields]));
          this.log("");
        }
      };

      if (flags.type) {
        await channel.annotations.subscribe(flags.type, callback);
      } else {
        await channel.annotations.subscribe(callback);
      }

      await attachPromise;

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(
            `Subscribed to annotations on channel: ${formatResource(channelName)}.`,
          ),
        );
        this.log(formatListening("Listening for annotations."));
        this.log("");
      }

      this.logCliEvent(
        flags,
        "annotationSubscribe",
        "listening",
        "Listening for annotations. Press Ctrl+C to exit.",
      );

      await this.waitAndTrackCleanup(
        flags,
        "annotationSubscribe",
        flags.duration,
      );
    } catch (error) {
      this.fail(error, flags, "annotationSubscribe", {
        channel: channelName,
      });
    }
  }
}
