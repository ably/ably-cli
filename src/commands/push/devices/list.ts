import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import {
  formatDeviceState,
  formatHeading,
  formatLabel,
  formatProgress,
  formatSuccess,
  formatCountLabel,
  formatLimitWarning,
} from "../../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationLog,
} from "../../../utils/pagination.js";

export default class PushDevicesList extends AblyBaseCommand {
  static override description = "List push device registrations";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --device-id device-123",
    "<%= config.bin %> <%= command.id %> --client-id client-1",
    "<%= config.bin %> <%= command.id %> --limit 50 --json",
  ];

  static override flags = {
    ...productApiFlags,
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    "client-id": Flags.string({
      description: "Filter by client ID",
    }),
    state: Flags.string({
      description: "Filter by device state",
      options: ["ACTIVE", "FAILING", "FAILED"],
    }),
    limit: Flags.integer({
      description: "Maximum number of results to return",
      default: 100,
      min: 1,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesList);

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Fetching device registrations"));
      }

      const params: Record<string, string | number> = {
        limit: flags.limit,
      };
      if (flags["device-id"]) params.deviceId = flags["device-id"];
      if (flags["client-id"]) params.clientId = flags["client-id"];
      if (flags.state) params.state = flags.state;

      const result = await rest.push.admin.deviceRegistrations.list(params);
      const {
        items: devices,
        hasMore,
        pagesConsumed,
      } = await collectPaginatedResults(result, flags.limit);

      const paginationWarning = formatPaginationLog(
        pagesConsumed,
        devices.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.log(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        const next = buildPaginationNext(hasMore);
        this.logJsonResult({ devices, hasMore, ...(next && { next }) }, flags);
        return;
      }

      if (devices.length === 0) {
        this.log("No device registrations found.");
        return;
      }

      this.log(
        formatSuccess(
          `Found ${formatCountLabel(devices.length, "device registration")}.`,
        ),
      );
      this.log("");

      for (const device of devices) {
        this.log(formatHeading(`Device ID: ${device.id}`));
        this.log(`  ${formatLabel("Platform")} ${device.platform}`);
        this.log(`  ${formatLabel("Form Factor")} ${device.formFactor}`);
        if (device.push.state)
          this.log(
            `  ${formatLabel("State")} ${formatDeviceState(device.push.state)}`,
          );
        if (device.clientId)
          this.log(`  ${formatLabel("Client ID")} ${device.clientId}`);
        const recipient = device.push.recipient as
          | Record<string, unknown>
          | undefined;
        if (recipient?.transportType) {
          this.log(
            `  ${formatLabel("Transport")} ${recipient.transportType as string}`,
          );
        }
        if (device.metadata) {
          this.log(
            `  ${formatLabel("Metadata")} ${JSON.stringify(device.metadata)}`,
          );
        }
        this.log("");
      }

      if (hasMore) {
        const limitWarning = formatLimitWarning(
          devices.length,
          flags.limit,
          "device registrations",
        );
        if (limitWarning) this.log(limitWarning);
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushDeviceList");
    }
  }
}
