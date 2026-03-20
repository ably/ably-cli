import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../utils/output.js";

export default class SpacesCreate extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to initialize",
      required: true,
    }),
  };

  static override description = `Initializes a space. Spaces are backed by Ably channel '{spaceName}::$space' and are ephemeral — they become active when members enter. This command initializes the space without entering it. Use 'ably spaces members enter SPACE_NAME' to add a member to the space.`;

  static override examples = [
    "$ ably spaces create my-space",
    "$ ably spaces create my-space --json",
    "$ ably spaces create my-space --client-id my-client",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCreate);
    const spaceName = args.space_name;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(`Initializing space ${formatResource(spaceName)}`),
        );
      }

      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ space: { name: spaceName } }, flags);
      } else {
        this.log(
          formatSuccess(
            `Space ${formatResource(spaceName)} initialized. Use ${formatResource("ably spaces members enter")} to activate it.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags, "spaceCreate");
    }
  }
}
