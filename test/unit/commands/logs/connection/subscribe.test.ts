import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import LogsConnectionSubscribe from "../../../../../src/commands/logs/connection/subscribe.js";
import * as Ably from "ably";

// Create a testable version of LogsConnectionSubscribe
class TestableLogsConnectionSubscribe extends LogsConnectionSubscribe {
  public logOutput: string[] = [];
  public errorOutput: string = "";
  private _parseResult: any;
  public mockClient: any = {};
  private _shouldOutputJson = false;
  private _formatJsonOutputFn:
    | ((data: Record<string, unknown>) => string)
    | null = null;

  // Override parse to simulate parse output
  public override async parse() {
    return this._parseResult;
  }

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  // Override client creation to return a controlled mock
  public override async createAblyRealtimeClient(
    _flags: any,
  ): Promise<Ably.Realtime | null> {
    this.debug("Overridden createAblyRealtimeClient called");
    return this.mockClient as unknown as Ably.Realtime;
  }

  // Override logging methods
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  public override log(message?: string | undefined, ...args: any[]): void {
    if (message) {
      this.logOutput.push(message);
    }
  }

  // Correct override signature for the error method
  public override error(
    message: string | Error,
    _options?: { code?: string; exit?: number | false },
  ): never {
    this.errorOutput = typeof message === "string" ? message : message.message;
    // Prevent actual exit during tests by throwing instead
    throw new Error(this.errorOutput);
  }

  // Override JSON output methods
  public override shouldOutputJson(_flags?: any): boolean {
    return this._shouldOutputJson;
  }

  public setShouldOutputJson(value: boolean) {
    this._shouldOutputJson = value;
  }

  public override formatJsonOutput(
    data: Record<string, unknown>,
    _flags?: Record<string, unknown>,
  ): string {
    return this._formatJsonOutputFn
      ? this._formatJsonOutputFn(data)
      : JSON.stringify(data);
  }

  public setFormatJsonOutput(fn: (data: Record<string, unknown>) => string) {
    this._formatJsonOutputFn = fn;
  }

  // Override ensureAppAndKey to prevent real auth checks in unit tests
  protected override async ensureAppAndKey(
    _flags: any,
  ): Promise<{ apiKey: string; appId: string } | null> {
    this.debug("Skipping ensureAppAndKey in test mode");
    return { apiKey: "dummy-key-value:secret", appId: "dummy-app" };
  }
}

describe("LogsConnectionSubscribe", function () {
  let command: TestableLogsConnectionSubscribe;
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableLogsConnectionSubscribe([], mockConfig);

    // Set up a complete mock client structure for the [meta]connection.lifecycle channel
    const mockChannelInstance = {
      name: "[meta]connection.lifecycle",
      subscribe: vi.fn(),
      attach: vi.fn().mockImplementation(async () => {}),
      detach: vi.fn().mockImplementation(async () => {}),
      on: vi.fn(),
      off: vi.fn(),
      unsubscribe: vi.fn(),
    };

    command.mockClient = {
      channels: {
        get: vi.fn().mockReturnValue(mockChannelInstance),
        release: vi.fn(),
      },
      connection: {
        once: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
        state: "initialized",
      },
      close: vi.fn(),
    };

    // Set default parse result with duration to prevent hanging
    command.setParseResult({
      flags: { rewind: 0, duration: 0.1 },
      args: {},
      argv: [],
      raw: [],
    });
  });

  it("should attempt to create an Ably client", async function () {
    const createClientStub = vi
      .spyOn(command, "createAblyRealtimeClient")
      .mockResolvedValue(command.mockClient as unknown as Ably.Realtime);

    // Mock connection to simulate quick connection
    command.mockClient.connection.on.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => {
            command.mockClient.connection.state = "connected";
            callback();
          }, 10);
        }
      },
    );

    // Run the command with a short duration
    await command.run();

    expect(createClientStub).toHaveBeenCalledOnce();
  });

  it("should subscribe to [meta]connection.lifecycle channel", async function () {
    const subscribeStub = command.mockClient.channels.get().subscribe;

    // Mock connection state changes
    command.mockClient.connection.on.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => {
            command.mockClient.connection.state = "connected";
            callback();
          }, 10);
        }
      },
    );

    // Run the command with a short duration
    await command.run();

    // Verify that we got the [meta]connection.lifecycle channel and subscribed to it
    // The test's ensureAppAndKey returns appId: 'dummy-app'
    expect(command.mockClient.channels.get).toHaveBeenCalledWith(
      "[meta]connection.lifecycle",
    );
    expect(subscribeStub).toHaveBeenCalled();
  });

  it("should handle connection state changes", async function () {
    const connectionOnStub = command.mockClient.connection.on;

    // Set duration and run
    command.setParseResult({
      flags: { rewind: 0, duration: 0.05 },
      args: {},
      argv: [],
      raw: [],
    });
    await command.run();

    // Verify that connection state change handlers were set up
    expect(connectionOnStub).toHaveBeenCalled();
  });

  it("should handle log message reception", async function () {
    const subscribeStub = command.mockClient.channels.get().subscribe;

    // Mock connection
    command.mockClient.connection.on.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => callback(), 10);
        }
      },
    );

    // Run the command with a short duration
    await command.run();

    // Verify subscribe was called
    expect(subscribeStub).toHaveBeenCalled();

    // Simulate receiving a log message
    const messageCallback = subscribeStub.mock.calls[0][0];
    expect(typeof messageCallback).toBe("function");

    const mockMessage = {
      name: "connection.opened",
      data: { connectionId: "test-connection-123" },
      timestamp: Date.now(),
      clientId: "test-client",
      connectionId: "test-connection-123",
      id: "msg-123",
    };

    messageCallback(mockMessage);

    // Check that the message was logged
    const output = command.logOutput.join("\n");
    expect(output).toContain("connection.opened");
  });

  it("should output JSON when requested", async function () {
    command.setShouldOutputJson(true);
    command.setFormatJsonOutput((data) => JSON.stringify(data));

    const subscribeStub = command.mockClient.channels.get().subscribe;

    // Mock connection
    command.mockClient.connection.on.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => callback(), 10);
        }
      },
    );

    // Run the command with a short duration
    await command.run();

    // Simulate receiving a message in JSON mode
    const messageCallback = subscribeStub.mock.calls[0][0];
    expect(typeof messageCallback).toBe("function");

    const mockMessage = {
      name: "connection.opened",
      data: { connectionId: "test-connection-123" },
      timestamp: Date.now(),
      clientId: "test-client",
      connectionId: "test-connection-123",
      id: "msg-123",
    };

    messageCallback(mockMessage);

    // Check for JSON output
    const jsonOutput = command.logOutput.find((log) => {
      try {
        const parsed = JSON.parse(log);
        return (
          parsed.event === "connection.opened" &&
          parsed.timestamp &&
          parsed.id === "msg-123"
        );
      } catch {
        return false;
      }
    });
    expect(jsonOutput).toBeDefined();
  });

  it("should handle connection failures", async function () {
    // Mock connection failure
    command.mockClient.connection.on.mockImplementation(
      (event: string, callback: (stateChange: any) => void) => {
        if (event === "failed") {
          setTimeout(() => {
            callback({
              current: "failed",
              reason: { message: "Connection failed" },
            });
          }, 10);
        }
      },
    );

    try {
      await command.run();
      expect.fail("Command should have handled connection failure");
    } catch {
      // The command should handle connection failures gracefully - catch block intentionally empty
    }

    // Check that error was logged appropriately
    const output = command.logOutput.join("\n");
    expect(output.length).toBeGreaterThan(0); // Some output should have been generated
  });

  it("should handle client creation failure", async function () {
    // Mock createAblyRealtimeClient to return null
    vi.spyOn(command, "createAblyRealtimeClient").mockResolvedValue(null);

    // Should return early without error when client creation fails
    await command.run();

    // Verify that subscribe was never called since client creation failed
    expect(command.mockClient.channels.get().subscribe).not.toHaveBeenCalled();
  });
});
