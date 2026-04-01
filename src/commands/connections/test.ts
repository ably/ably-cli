import { Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { extractErrorInfo } from "../../utils/errors.js";
import { clientIdFlag, productApiFlags } from "../../flags.js";
import { formatResource } from "../../utils/output.js";

export default class ConnectionsTest extends AblyBaseCommand {
  static override description = "Test connection to Ably";

  static override examples = [
    "$ ably connections test",
    "$ ably connections test --transport ws",
    "$ ably connections test --transport xhr",
    "$ ably connections test --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    transport: Flags.string({
      default: "all",
      description:
        "Transport protocol to use (ws for WebSockets, xhr for HTTP)",
      options: ["ws", "xhr", "all"],
    }),
  };

  private wsClient: Ably.Realtime | null = null;
  private xhrClient: Ably.Realtime | null = null;

  // Override finally to ensure resources are cleaned up
  async finally(err: Error | undefined): Promise<void> {
    if (
      this.wsClient &&
      this.wsClient.connection.state !== "closed" &&
      this.wsClient.connection.state !== "failed"
    ) {
      this.wsClient.close();
    }

    if (
      this.xhrClient &&
      this.xhrClient.connection.state !== "closed" &&
      this.xhrClient.connection.state !== "failed"
    ) {
      this.xhrClient.close();
    }

    return super.finally(err);
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(ConnectionsTest);

    let wsSuccess = false;
    let xhrSuccess = false;
    let wsError: Error | null = null;
    let xhrError: Error | null = null;
    const baseOptions: Ably.ClientOptions = this.getClientOptions(flags);

    try {
      // Run tests based on flags
      if (flags.transport === "all" || flags.transport === "ws") {
        const result = await this.testWebSocketConnection(baseOptions, flags);
        wsSuccess = result.success;
        wsError = result.error;
      }

      if (flags.transport === "all" || flags.transport === "xhr") {
        const result = await this.testXhrConnection(baseOptions, flags);
        xhrSuccess = result.success;
        xhrError = result.error;
      }

      this.outputSummary(flags, wsSuccess, xhrSuccess, wsError, xhrError);
    } catch (error: unknown) {
      this.fail(error, flags, "connectionTest");
    } finally {
      // Ensure clients are closed (handled by the finally override)
    }
  }

  // --- Refactored Test Methods ---

  private outputSummary(
    flags: Record<string, unknown>,
    wsSuccess: boolean,
    xhrSuccess: boolean,
    wsError: Error | null,
    xhrError: Error | null,
  ): void {
    const summary = {
      ws: {
        error: wsError ? extractErrorInfo(wsError) : null,
        success: wsSuccess,
      },
      xhr: {
        error: xhrError ? extractErrorInfo(xhrError) : null,
        success: xhrSuccess,
      },
    };
    this.logCliEvent(
      flags,
      "connectionTest",
      "summary",
      "Connection test summary",
      summary,
    );

    if (this.shouldOutputJson(flags)) {
      // Output JSON summary
      let jsonOutput: Record<string, unknown>;

      switch (flags.transport) {
        case "all": {
          jsonOutput = {
            testPassed: wsSuccess && xhrSuccess,
            transport: "all",
            ws: summary.ws,
            xhr: summary.xhr,
          };
          break;
        }
        case "ws": {
          jsonOutput = {
            testPassed: wsSuccess,
            transport: "ws",
            connectionId: wsSuccess ? this.wsClient?.connection.id : undefined,
            connectionKey: wsSuccess
              ? this.wsClient?.connection.key
              : undefined,
            error: wsError ? extractErrorInfo(wsError) : undefined,
          };
          break;
        }
        case "xhr": {
          jsonOutput = {
            testPassed: xhrSuccess,
            transport: "xhr",
            connectionId: xhrSuccess
              ? this.xhrClient?.connection.id
              : undefined,
            connectionKey: xhrSuccess
              ? this.xhrClient?.connection.key
              : undefined,
            error: xhrError ? extractErrorInfo(xhrError) : undefined,
          };
          break;
        }
        default: {
          jsonOutput = {
            testPassed: false,
            error: { message: "Unknown transport" },
          };
        }
      }

      this.logJsonResult({ connection: jsonOutput }, flags);
    } else {
      this.log("");
      this.log("Connection Test Summary:");
    }

    switch (flags.transport) {
      case "all": {
        // If both were tested
        const allSuccess = wsSuccess && xhrSuccess;
        const partialSuccess = wsSuccess || xhrSuccess;

        if (allSuccess) {
          this.logSuccessMessage(
            "All connection tests passed successfully.",
            flags,
          );
        } else if (partialSuccess) {
          this.logWarning(
            "Some connection tests succeeded, but others failed",
            flags,
          );
        } else {
          this.logWarning("All connection tests failed.", flags);
        }

        break;
      }

      case "ws": {
        if (wsSuccess) {
          this.logSuccessMessage(
            "WebSocket connection test passed successfully.",
            flags,
          );
        } else {
          this.logWarning("WebSocket connection test failed.", flags);
        }

        break;
      }

      case "xhr": {
        if (xhrSuccess) {
          this.logSuccessMessage(
            "HTTP connection test passed successfully.",
            flags,
          );
        } else {
          this.logWarning("HTTP connection test failed.", flags);
        }

        break;
      }
      // No default
    }
  }

  private async testWebSocketConnection(
    baseOptions: Ably.ClientOptions,
    flags: Record<string, unknown>,
  ): Promise<{ error: Error | null; success: boolean }> {
    const result = await this.testTransport(baseOptions, flags, {
      displayName: "WebSocket",
      prefix: "ws",
      transportParams: { disallowXHR: true, preferWebSockets: true },
    });
    this.wsClient = result.client;
    return { error: result.error, success: result.success };
  }

  private async testXhrConnection(
    baseOptions: Ably.ClientOptions,
    flags: Record<string, unknown>,
  ): Promise<{ error: Error | null; success: boolean }> {
    const result = await this.testTransport(baseOptions, flags, {
      displayName: "HTTP",
      prefix: "xhr",
      transportParams: { disallowWebSockets: true },
    });
    this.xhrClient = result.client;
    return { error: result.error, success: result.success };
  }

  private async testTransport(
    baseOptions: Ably.ClientOptions,
    flags: Record<string, unknown>,
    config: {
      displayName: string;
      prefix: string;
      transportParams: Record<string, boolean>;
    },
  ): Promise<{
    client: Ably.Realtime | null;
    error: Error | null;
    success: boolean;
  }> {
    let success = false;
    let errorResult: Error | null = null;

    this.logCliEvent(
      flags,
      "connectionTest",
      `${config.prefix}TestStarting`,
      `Testing ${config.displayName} connection...`,
    );
    this.logProgress(`Testing ${config.displayName} connection to Ably`, flags);

    let client: Ably.Realtime | null = null;

    try {
      const options: Ably.ClientOptions = {
        ...baseOptions,
        transportParams: config.transportParams,
      };
      client = new Ably.Realtime(options);

      client.connection.on((stateChange: Ably.ConnectionStateChange) => {
        this.logCliEvent(
          flags,
          "connectionTest",
          `${config.prefix}StateChange-${stateChange.current}`,
          `${config.displayName} connection state changed to ${stateChange.current}`,
          { reason: stateChange.reason },
        );
      });

      await new Promise<void>((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          const timeoutError = new Error("Connection timeout after 10 seconds");
          this.logCliEvent(
            flags,
            "connectionTest",
            `${config.prefix}Timeout`,
            timeoutError.message,
            { error: timeoutError.message },
          );
          reject(timeoutError);
        }, 10_000);

        client!.connection.once("connected", () => {
          clearTimeout(connectionTimeout);
          success = true;
          this.logCliEvent(
            flags,
            "connectionTest",
            `${config.prefix}Success`,
            `${config.displayName} connection successful`,
            { connectionId: client!.connection.id },
          );
          this.logSuccessMessage(
            `${config.displayName} connection successful.`,
            flags,
          );
          if (!this.shouldOutputJson(flags)) {
            this.log(
              `  Connection ID: ${formatResource(client!.connection.id || "unknown")}`,
            );
          }
          resolve();
        });

        client!.connection.once("failed", (stateChange) => {
          clearTimeout(connectionTimeout);
          errorResult = stateChange.reason || new Error("Connection failed");
          this.logCliEvent(
            flags,
            "connectionTest",
            `${config.prefix}Failed`,
            `${config.displayName} connection failed: ${errorResult.message}`,
            { error: errorResult.message, reason: stateChange.reason },
          );
          this.logWarning(
            `${config.displayName} connection failed: ${errorResult.message}`,
            flags,
          );
          resolve();
        });
      });
    } catch (error) {
      errorResult = error as Error;
      this.logCliEvent(
        flags,
        "connectionTest",
        `${config.prefix}Error`,
        `${config.displayName} connection test caught error: ${errorResult.message}`,
        { error: errorResult.message },
      );
      this.logWarning(
        `${config.displayName} connection failed: ${errorResult.message}`,
        flags,
      );
    }

    return { client, error: errorResult, success };
  }
}
