import React from "react";
import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { productApiFlags, clientIdFlag } from "../../../flags.js";
import isTestMode from "../../../utils/test-mode.js";
import { createOrchestrator } from "../../../services/ai-transport-demo/lib/orchestrator.js";
import type { DemoOrchestrator } from "../../../services/ai-transport-demo/lib/orchestrator.js";

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
    ...clientIdFlag,
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

  private orchestrator: DemoOrchestrator | null = null;
  private ablyClient: import("ably").Realtime | null = null;

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
    const clientId =
      flags["client-id"] ?? `demo-${Math.random().toString(36).slice(2, 8)}`;

    // In test mode, output a marker and return (Ink can't render in tests)
    if (isTestMode()) {
      this.log(
        `AI Transport Streaming Demo (coming soon). ` +
          `Role: ${role}, Channel: ${channelName}`,
      );
      return;
    }

    // Create Ably client
    this.ablyClient = await this.createAblyRealtimeClient(flags);
    if (!this.ablyClient) {
      this.fail("Failed to create Ably client", flags, "aiTransportDemo");
    }

    const channel = this.ablyClient.channels.get(channelName);

    // Create the orchestrator (startup is triggered by the App component
    // after event listeners are attached, so no events are missed)
    this.orchestrator = createOrchestrator({
      channel,
      feature: "streaming",
      endpoint: flags.endpoint,
      clientId,
      onFatalError: () => {
        // Close the Ably connection to stop the SDK retrying
        if (this.ablyClient) {
          this.ablyClient.close();
          this.ablyClient = null;
        }
      },
    });

    // Catch unhandled errors from the Ably SDK (e.g., mutable messages 93002)
    // that are thrown from WebSocket message handlers outside our try/catch.
    // We emit the event on the orchestrator so the TUI shows the setup screen.
    const orchestratorRef = this.orchestrator;
    const unhandledHandler = (error: Error) => {
      const msg = String(error);
      if (msg.includes("93002") || msg.includes("mutableMessages")) {
        orchestratorRef?.emit("mutableMessagesRequired");
        return;
      }

      // For other errors, log to stderr but don't crash the TUI
      process.stderr.write(`Unhandled error: ${msg}\n`);
    };

    process.on("uncaughtException", unhandledHandler);

    // Bypass Ink's CI detection (CI_* env vars trigger is-in-ci)
    const prevCi = process.env.CI;
    process.env.CI = "0";

    try {
      const { render } = await import("ink");
      const { App } = await import(
        "../../../services/ai-transport-demo/ui/App.js"
      );

      const { waitUntilExit } = render(
        React.createElement(App, {
          role,
          feature: "streaming",
          channelName,
          orchestrator: this.orchestrator,
        }),
      );

      await waitUntilExit();
    } finally {
      process.off("uncaughtException", unhandledHandler);

      if (prevCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = prevCi;
      }
    }
  }

  async finally(error: Error | undefined): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.close();
      this.orchestrator = null;
    }

    if (this.ablyClient) {
      this.ablyClient.close();
      this.ablyClient = null;
    }

    await super.finally(error);
  }
}
