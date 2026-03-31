import { Args } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import {
  formatDeviceState,
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class PushDevicesGet extends AblyBaseCommand {
  static override args = {
    "device-id": Args.string({
      description: "The device ID to retrieve",
      required: true,
    }),
  };

  static override description = "Get details of a push device registration";

  static override examples = [
    "<%= config.bin %> <%= command.id %> device-123",
    "<%= config.bin %> <%= command.id %> device-123 --json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PushDevicesGet);
    const deviceId = args["device-id"];

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress(`Fetching device ${formatResource(deviceId)}`));
      }

      const device = await rest.push.admin.deviceRegistrations.get(deviceId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ device }, flags);
        return;
      }

      this.log(formatSuccess(`Device ${formatResource(deviceId)} found.`));
      this.log("");
      this.log(`${formatLabel("Device ID")} ${device.id}`);
      this.log(`${formatLabel("Platform")} ${device.platform}`);
      this.log(`${formatLabel("Form Factor")} ${device.formFactor}`);
      if (device.clientId)
        this.log(`${formatLabel("Client ID")} ${device.clientId}`);
      if (device.push.state)
        this.log(
          `${formatLabel("State")} ${formatDeviceState(device.push.state)}`,
        );
      const recipient = device.push.recipient as
        | Record<string, unknown>
        | undefined;
      if (recipient?.transportType) {
        this.log(
          `${formatLabel("Transport Type")} ${recipient.transportType as string}`,
        );
      }
      if (recipient?.deviceToken) {
        const token = recipient.deviceToken as string;
        const redacted =
          token.length > 8
            ? `${token.slice(0, 4)}...${token.slice(-4)} (redacted)`
            : "****(redacted)";
        this.log(`${formatLabel("Device Token")} ${redacted}`);
      }
      if (recipient?.targetUrl) {
        this.log(
          `${formatLabel("Target URL")} ${recipient.targetUrl as string}`,
        );
      }
      if (device.metadata) {
        this.log(
          `${formatLabel("Metadata")} ${JSON.stringify(device.metadata)}`,
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushDeviceGet");
    }
  }
}
