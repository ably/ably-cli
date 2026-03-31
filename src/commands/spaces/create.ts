import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";
import { formatResource } from "../../utils/output.js";

export default class SpacesCreate extends SpacesBaseCommand {
  static override args = {
    space_name: Args.string({
      description: "Name of the space to initialize",
      required: true,
    }),
  };

  static override description = "Initialize a space without entering it";

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
      this.logProgress(
        `Initializing space ${formatResource(spaceName)}`,
        flags,
      );

      await this.initializeSpace(flags, spaceName, {
        enterSpace: false,
        setupConnectionLogging: false,
      });

      const ephemeralSpaceWarning = `Spaces are ephemeral, they become active when members enter. Use 'ably spaces members enter ${spaceName}'`;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            space: { name: spaceName },
            hint: ephemeralSpaceWarning,
          },
          flags,
        );
      } else {
        this.logSuccessMessage(
          `Space ${formatResource(spaceName)} initialized. Use "ably spaces members enter" to activate it.`,
          flags,
        );
        this.logWarning(ephemeralSpaceWarning, flags);
      }
    } catch (error) {
      this.fail(error, flags, "spaceCreate");
    }
  }
}
