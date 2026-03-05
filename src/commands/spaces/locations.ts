import chalk from "chalk";

import { productApiFlags } from "../../flags.js";
import { SpacesBaseCommand } from "../../spaces-base-command.js";

export default class SpacesLocations extends SpacesBaseCommand {
  static override description =
    "Spaces Locations API commands (Ably Spaces client-to-client location sharing)";

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    await this.parse(SpacesLocations);
    this.log(chalk.bold.cyan("Spaces Locations API Commands:"));
    this.log("\nAvailable commands:");
    this.log(
      "  ably spaces locations get-all    - Get all current locations in a space",
    );
    this.log(
      "  ably spaces locations set        - Set location for a client in the space",
    );
    this.log(
      "  ably spaces locations subscribe  - Subscribe to location updates in a space",
    );
    this.log(
      "  ably spaces locations clear      - Clear location for the current client",
    );
  }
}
