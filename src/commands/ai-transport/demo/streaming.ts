import React from "react";
import { Flags } from "@oclif/core";
import { render } from "ink";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { productApiFlags } from "../../../flags.js";
import isTestMode from "../../../utils/test-mode.js";
import { App } from "../../../services/ai-transport-demo/ui/App.js";

export default class StreamingDemo extends ControlBaseCommand {
  static override description =
    "Demo AI Transport token streaming in a split-pane TUI";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --role client --channel my-session",
    "<%= config.bin %> <%= command.id %> --role server",
  ];

  static override flags = {
    ...productApiFlags,
    role: Flags.string({
      description: "Run as both client and server, or just one side",
      options: ["both", "client", "server"],
      default: "both",
    }),
    channel: Flags.string({
      description: "Channel name to use (auto-generated if not provided)",
    }),
    endpoint: Flags.string({
      description:
        "Server HTTP endpoint for sending messages (client-only, skips presence discovery)",
    }),
    "auth-endpoint": Flags.string({
      description:
        "Auth endpoint returning JWT tokens (client-only, for external servers)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StreamingDemo);

    if (flags.endpoint && flags.role !== "client") {
      this.fail(
        "--endpoint can only be used with --role client",
        flags,
        "aiTransportDemo",
      );
    }

    if (flags["auth-endpoint"] && flags.role !== "client") {
      this.fail(
        "--auth-endpoint can only be used with --role client",
        flags,
        "aiTransportDemo",
      );
    }

    const role = (flags.role ?? "both") as "both" | "client" | "server";
    const channelName =
      flags.channel ??
      `ai-demo:streaming-${Math.random().toString(36).slice(2, 6)}`;

    // In test mode, just output a marker and return (Ink can't render in tests)
    if (isTestMode()) {
      this.log(
        `AI Transport Streaming Demo (coming soon). ` +
          `Role: ${role}, Channel: ${channelName}`,
      );
      return;
    }

    // Render the TUI
    const { waitUntilExit } = render(
      React.createElement(App, {
        role,
        feature: "streaming",
        channelName,
      }),
    );

    await waitUntilExit();
  }
}
