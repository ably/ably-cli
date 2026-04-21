/**
 * Shared runner for the ai-transport demo commands.
 *
 * Each demo command (streaming, barge-in, cancel) delegates to runDemo()
 * with its feature name. The runner handles Ably client creation, channel
 * namespace validation, SDK log suppression, Ink rendering, and cleanup
 * so the command files stay small and focused on feature metadata.
 */

import React from "react";
import type * as Ably from "ably";

import isTestMode from "../../../utils/test-mode.js";
import { createOrchestrator } from "./orchestrator.js";
import type { DemoOrchestrator } from "./orchestrator.js";

export interface RunDemoOptions {
  /** The feature name — picks the response bank and shows in the header. */
  feature: string;
  /** Parsed flags from the command. */
  flags: {
    role?: string;
    channel?: string;
    endpoint?: string;
    "auth-endpoint"?: string;
    "client-id"?: string;
  } & Record<string, unknown>;
}

/**
 * Runtime handles that must be cleaned up in the command's finally() block.
 */
export interface RunDemoHandles {
  orchestrator: DemoOrchestrator | null;
  ablyClient: Ably.Realtime | null;
  origStdoutWrite: typeof process.stdout.write | null;
  origStderrWrite: typeof process.stderr.write | null;
  unhandledHandler: ((error: Error) => void) | null;
}

/**
 * Minimal shape of the hosting command class. Using an interface rather
 * than importing ControlBaseCommand keeps the dependency direction clean
 * (services should not import from commands/). The typed flags object is
 * opaque here — the command closes over it when wiring the callbacks.
 */
export interface DemoCommandHost {
  log: (msg: string) => void;
  fail: (msg: string, component: string) => never;
  createAblyRealtimeClient: () => Promise<Ably.Realtime | null>;
}

/**
 * Run a demo command end-to-end. The caller should hold onto the returned
 * handles so it can tear them down in its own finally() hook.
 */
export async function runDemo(
  command: DemoCommandHost,
  options: RunDemoOptions,
  handles: RunDemoHandles,
): Promise<void> {
  const { feature, flags } = options;

  if (flags.endpoint && flags.role !== "client") {
    command.fail(
      "--endpoint can only be used with --role client",
      "aiTransportDemo",
    );
  }

  if (flags["auth-endpoint"] && flags.role !== "client") {
    command.fail(
      "--auth-endpoint can only be used with --role client",
      "aiTransportDemo",
    );
  }

  const role = (flags.role ?? "both") as "both" | "client" | "server";

  // Channel must include a namespace (colon separator) because AI Transport
  // requires mutable messages, which is configured per-namespace via rules.
  if (flags.channel && !flags.channel.includes(":")) {
    command.fail(
      `Channel name must include a namespace (e.g. "my-namespace:${flags.channel}"). ` +
        `AI Transport requires mutable messages, which is enabled per-namespace via rules. ` +
        `If you don't have a namespace, omit --channel and the demo will use "ai-demo:" by default.`,
      "aiTransportDemo",
    );
  }

  const channelName =
    flags.channel ??
    `ai-demo:${feature}-${Math.random().toString(36).slice(2, 6)}`;
  const clientId =
    flags["client-id"] ?? `demo-${Math.random().toString(36).slice(2, 8)}`;

  // In test mode, output a marker and return (Ink can't render in tests)
  if (isTestMode()) {
    command.log(
      `AI Transport ${formatFeatureName(feature)} Demo (coming soon). ` +
        `Role: ${role}, Channel: ${channelName}`,
    );
    return;
  }

  // Create Ably client
  handles.ablyClient = await command.createAblyRealtimeClient();
  if (!handles.ablyClient) {
    command.fail("Failed to create Ably client", "aiTransportDemo");
  }

  const channel = handles.ablyClient.channels.get(channelName);

  // Create the orchestrator (startup is triggered by the App component
  // after event listeners are attached, so no events are missed)
  handles.orchestrator = createOrchestrator({
    channel,
    feature,
    endpoint: flags.endpoint,
    clientId,
    onFatalError: () => {
      if (handles.ablyClient) {
        handles.ablyClient.close();
        handles.ablyClient = null;
      }
    },
  });

  // The AIT SDK encoder floods stderr/stdout with NACK errors when
  // mutableMessages is not enabled. Its logger captures console.* at
  // module load, so we must intercept at process.stdout/stderr.write.
  const orchestratorRef = handles.orchestrator;
  let mutableErrorDetected = false;

  const unhandledHandler = (error: Error): void => {
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

    if (msg.includes("Rate limit") || msg.includes("rate limit")) {
      orchestratorRef?.emit("serverLog", `⚠ Rate limit hit`);
      return;
    }

    orchestratorRef?.emit("serverLog", `⚠ ${msg.slice(0, 80)}`);
  };

  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  handles.origStdoutWrite = origStdoutWrite;
  handles.origStderrWrite = origStderrWrite;
  handles.unhandledHandler = unhandledHandler;

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
    const { App } = await import("../ui/App.js");

    const { waitUntilExit } = render(
      React.createElement(App, {
        role,
        feature,
        channelName,
        orchestrator: handles.orchestrator,
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

/**
 * Tear down the runtime handles. Call from the command's finally() hook
 * so any SDK cleanup output stays suppressed until the Ably client is
 * fully closed.
 */
export async function cleanupDemo(handles: RunDemoHandles): Promise<void> {
  if (handles.orchestrator) {
    await handles.orchestrator.close();
    handles.orchestrator = null;
  }

  if (handles.ablyClient) {
    handles.ablyClient.close();
    handles.ablyClient = null;
  }

  // Small delay to let any final SDK async cleanup complete while
  // interceptors are still active
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (handles.origStdoutWrite) {
    process.stdout.write = handles.origStdoutWrite;
    handles.origStdoutWrite = null;
  }

  if (handles.origStderrWrite) {
    process.stderr.write = handles.origStderrWrite;
    handles.origStderrWrite = null;
  }

  if (handles.unhandledHandler) {
    process.off("uncaughtException", handles.unhandledHandler);
    handles.unhandledHandler = null;
  }
}

export function formatFeatureName(feature: string): string {
  return feature
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
