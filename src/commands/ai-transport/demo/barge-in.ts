import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { productApiFlags, clientIdFlag } from "../../../flags.js";
import {
  runDemo,
  cleanupDemo,
  type RunDemoHandles,
  type DemoCommandHost,
} from "../../../services/ai-transport-demo/lib/run-demo.js";

export default class BargeInDemo extends ControlBaseCommand {
  static override description =
    "Demo AI Transport barge-in: interrupt a streaming response mid-flight";

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

  private handles: RunDemoHandles = {
    orchestrator: null,
    ablyClient: null,
    origStdoutWrite: null,
    origStderrWrite: null,
    unhandledHandler: null,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(BargeInDemo);
    const host: DemoCommandHost = {
      log: (msg) => this.log(msg),
      fail: (msg, component) => this.fail(msg, flags, component),
      createAblyRealtimeClient: () => this.createAblyRealtimeClient(flags),
    };
    await runDemo(host, { feature: "barge-in", flags }, this.handles);
  }

  async finally(error: Error | undefined): Promise<void> {
    await cleanupDemo(this.handles);
    await super.finally(error);
  }
}
