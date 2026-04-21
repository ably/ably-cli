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
  private origStdoutWrite: typeof process.stdout.write | null = null;
  private origStderrWrite: typeof process.stderr.write | null = null;
  private unhandledHandler: ((error: Error) => void) | null = null;

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

    // Channel must include a namespace (colon separator) because AI Transport
    // requires mutable messages, which is configured per-namespace via rules.
    // Without a namespace, we can't guide the user to create the right rule.
    if (flags.channel && !flags.channel.includes(":")) {
      this.fail(
        `Channel name must include a namespace (e.g. "my-namespace:${flags.channel}"). ` +
          `AI Transport requires mutable messages, which is enabled per-namespace via rules. ` +
          `If you don't have a namespace, omit --channel and the demo will use "ai-demo:" by default.`,
        flags,
        "aiTransportDemo",
      );
    }

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

    // The AIT SDK encoder floods stderr/stdout with NACK errors and
    // PromiseRejectionHandledWarnings when mutableMessages is not enabled.
    // The SDK's logger captures console.log/warn at module load time in
    // closures, so overriding console.* doesn't work. We must intercept
    // at the process.stdout/stderr.write level.
    const orchestratorRef = this.orchestrator;
    let mutableErrorDetected = false;

    // 1. Catch uncaught exceptions from the SDK's WebSocket handler
    const unhandledHandler = (error: Error) => {
      const msg = String(error);
      if (msg.includes("93002") || msg.includes("mutableMessages")) {
        if (!mutableErrorDetected) {
          mutableErrorDetected = true;
          orchestratorRef?.emit("mutableMessagesRequired");
        }

        return;
      }

      if (msg.includes("80017") || msg.includes("Connection closed")) {
        return;
      }

      // Route rate limit and other SDK errors to the server log
      // instead of dumping them to stderr
      if (msg.includes("Rate limit") || msg.includes("rate limit")) {
        orchestratorRef?.emit("serverLog", `⚠ Rate limit hit`);
        return;
      }

      orchestratorRef?.emit(
        "serverLog",
        `⚠ ${msg.slice(0, 80)}`,
      );
    };

    // 2. Intercept process.stdout.write and process.stderr.write to
    //    suppress [AblySDK Error] NACK spam and PromiseRejectionHandledWarning.
    //    This is the only reliable way since the SDK captures console.*
    //    references at module load time.
    const origStdoutWrite = process.stdout.write;
    const origStderrWrite = process.stderr.write;
    this.origStdoutWrite = origStdoutWrite;
    this.origStderrWrite = origStderrWrite;
    this.unhandledHandler = unhandledHandler;

    const isSuppressable = (str: string): boolean =>
      (mutableErrorDetected &&
        (str.includes("93002") ||
          str.includes("mutableMessages") ||
          str.includes("onNack") ||
          str.includes("80017") ||
          str.includes("failQueuedMessages") ||
          str.includes("PromiseRejectionHandledWarning") ||
          str.includes("AblySDK Error"))) ||
      str.includes("Rate limit") ||
      str.includes("rate limit");

    process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
      if (typeof chunk === "string" && isSuppressable(chunk)) return true;
      return origStdoutWrite.apply(process.stdout, [chunk, ...args] as never);
    }) as typeof process.stdout.write;

    process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
      if (typeof chunk === "string" && isSuppressable(chunk)) return true;
      return origStderrWrite.apply(process.stderr, [chunk, ...args] as never);
    }) as typeof process.stderr.write;

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
      // Only restore CI env here — stdout/stderr interceptors are restored
      // in the class finally() after Ably client is fully closed
      if (prevCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = prevCi;
      }
    }
  }

  async finally(error: Error | undefined): Promise<void> {
    // Close orchestrator and Ably client while interceptors are still active
    // so any SDK cleanup output is suppressed
    if (this.orchestrator) {
      await this.orchestrator.close();
      this.orchestrator = null;
    }

    if (this.ablyClient) {
      this.ablyClient.close();
      this.ablyClient = null;
    }

    // Small delay to let any final SDK async cleanup complete while
    // interceptors are still active
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Now restore stdout/stderr and uncaughtException handler
    if (this.origStdoutWrite) {
      process.stdout.write = this.origStdoutWrite;
      this.origStdoutWrite = null;
    }

    if (this.origStderrWrite) {
      process.stderr.write = this.origStderrWrite;
      this.origStderrWrite = null;
    }

    if (this.unhandledHandler) {
      process.off("uncaughtException", this.unhandledHandler);
      this.unhandledHandler = null;
    }

    await super.finally(error);
  }
}
