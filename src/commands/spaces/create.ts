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
    space: Args.string({
      description: "Space to create",
      required: true,
    }),
  };

  static override description = "Create a new space";

  static override examples = [
    "$ ably spaces create my-space",
    "$ ably spaces create my-space --json",
    "$ ably spaces create my-space --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SpacesCreate);
    const { space: spaceName } = args;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress(`Creating space ${formatResource(spaceName)}`));
      }

      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      this.logCliEvent(
        flags,
        "space",
        "created",
        "Space created successfully",
        { spaceName },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            space: {
              name: spaceName,
            },
          },
          flags,
        );
      } else {
        this.log(formatSuccess(`Space ${formatResource(spaceName)} created.`));
      }
    } catch (error) {
      this.fail(error, flags, "spaceCreate", { spaceName });
    }
  }
}
