import React from "react";
import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { productApiFlags } from "../../../flags.js";
import isTestMode from "../../../utils/test-mode.js";

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

    // Ink's is-in-ci detects any env var starting with CI_ and suppresses
    // interactive output. CI_BYPASS_SECRET or similar vars trigger this even
    // on dev machines. We must set CI=0 before importing ink so the module-level
    // check evaluates to false.
    const prevCi = process.env.CI;
    process.env.CI = "0";

    try {
      // Dynamic import so CI=0 is set before ink's is-in-ci evaluates
      const { render } = await import("ink");
      const { App } = await import(
        "../../../services/ai-transport-demo/ui/App.js"
      );

      const { waitUntilExit } = render(
        React.createElement(App, {
          role,
          feature: "streaming",
          channelName,
        }),
      );

      await waitUntilExit();
    } finally {
      if (prevCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = prevCi;
      }
    }
  }
}
