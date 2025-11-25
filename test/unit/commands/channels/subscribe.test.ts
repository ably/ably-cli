import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import ChannelsSubscribe from "../../../../src/commands/channels/subscribe.js";
import * as Ably from "ably";

// Create a testable version of ChannelsSubscribe
class TestableChannelsSubscribe extends ChannelsSubscribe {
  public logOutput: string[] = [];
  public errorOutput: string = "";
  private _parseResult: any;
  public mockClient: any = {}; // Initialize mockClient
  private _shouldOutputJson = false;
  private _formatJsonOutputFn:
    | ((data: Record<string, unknown>) => string)
    | null = null;

  // Spy on client creation attempt
  public createAblyClientSpy = vi.fn(super.createAblyRealtimeClient);

  // Override parse to simulate parse output
  public override async parse() {
    if (!this._parseResult) {
      // Default parse result if not set
      this._parseResult = {
        flags: { delta: false, rewind: undefined, "cipher-key": undefined },
        args: { channels: ["default-test-channel"] }, // Use args.channels directly
        argv: ["default-test-channel"], // argv should contain the channel names
        raw: [],
      };
    }
    return this._parseResult;
  }

  public setParseResult(result: any) {
    this._parseResult = result;
    // Ensure argv reflects args.channels for run() method logic
    if (result.args?.channels && Array.isArray(result.args.channels)) {
      this._parseResult.argv = [...result.args.channels];
    }
  }

  // Override client creation to return a controlled mock
  public override async createAblyRealtimeClient(
    flags: any,
  ): Promise<Ably.Realtime | null> {
    this.debug("Overridden createAblyRealtimeClient called");
    this.createAblyClientSpy(flags);

    // Initialize the mock client with basic structure
    const mockChannelInstance = {
      name: "mock-channel-from-create", // Add name for safety
      subscribe: vi.fn(),
      attach: vi.fn().mockImplementation(async () => {}),
      on: vi.fn(),
      unsubscribe: vi.fn(),
      detach: vi.fn().mockImplementation(async () => {}),
    };
    this.mockClient = {
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

    return this.mockClient as unknown as Ably.Realtime;
  }

  // Helper to connect the mock client
  public simulateConnection() {
    // Simulate a connected state
    this.mockClient.connection.state = "connected";

    // Find the connection.on handler and call it with connected state
    if (this.mockClient.connection.on.called) {
      const onConnectionArgs = this.mockClient.connection.on.args[0];
      if (onConnectionArgs && typeof onConnectionArgs[0] === "function") {
        onConnectionArgs[0]({ current: "connected" });
      }
    }
  }

  // Override logging methods
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  public override log(message?: string | undefined, ...args: any[]): void {
    // Attempt to capture chalk output or force to string
    const plainMessage =
      typeof message === "string" ? message : String(message);
    this.logOutput.push(plainMessage);
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

describe("ChannelsSubscribe (Simplified)", function () {
  let command: TestableChannelsSubscribe;
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableChannelsSubscribe([], mockConfig);

    // Setup mock client within beforeEach to ensure fresh state
    const mockChannelInstance = {
      name: "test-channel",
      subscribe: vi.fn(),
      attach: vi.fn().mockImplementation(async () => {}),
      on: vi.fn(), // Handles channel state changes ('attached', 'failed', etc.)
      unsubscribe: vi.fn(),
      detach: vi.fn().mockImplementation(async () => {}),
    };
    command.mockClient = {
      channels: {
        get: vi.fn().mockReturnValue(mockChannelInstance),
        release: vi.fn(),
      },
      connection: {
        once: vi.fn(), // Used for initial connection check
        on: vi.fn(), // Used for continuous state monitoring
        close: vi.fn(),
        state: "initialized",
      },
      close: vi.fn(),
    };

    // Set default parse result
    command.setParseResult({
      flags: { delta: false, rewind: undefined, "cipher-key": undefined },
      args: { channels: ["test-channel"] },
      raw: [],
    });

    // IMPORTANT: Stub createAblyRealtimeClient directly on the instance IN beforeEach
    // This ensures the command uses OUR mockClient setup here.
    vi.spyOn(
      command,
      "createAblyRealtimeClient" as keyof TestableChannelsSubscribe,
    ).mockResolvedValue(command.mockClient as unknown as Ably.Realtime);
  });

  // Helper function to manage test run with timeout/abort
  async function runCommandAndSimulateLifecycle(timeoutMs = 100) {
    // Store original listeners to restore them later
    const originalListeners = process.listeners("SIGINT");

    // Set up connection simulation
    command.mockClient.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => {
            command.mockClient.connection.state = "connected";
            if (command.mockClient.connection.on.mock.calls.length > 0) {
              const onConnectionArgs =
                command.mockClient.connection.on.mock.calls[0];
              if (
                onConnectionArgs &&
                typeof onConnectionArgs[0] === "function"
              ) {
                onConnectionArgs[0]({ current: "connected" });
              }
            }
            callback();
          }, 10);
        } else if (event === "closed") {
          // Simulate connection close after a short delay
          setTimeout(() => {
            command.mockClient.connection.state = "closed";
            callback();
          }, 30);
        }
      },
    );

    // Simulate channel attach after connection
    const originalGet = command.mockClient.channels.get;
    command.mockClient.channels.get = vi
      .fn()
      .mockImplementation((name, options) => {
        const channelMock = originalGet(name, options);
        if (channelMock && channelMock.on) {
          setTimeout(() => {
            const onAttachArgs = channelMock.on.mock.calls.find(
              (args: any[]) => args[0] === "attached",
            );
            if (onAttachArgs && typeof onAttachArgs[1] === "function") {
              onAttachArgs[1]({ current: "attached" });
            }
          }, 20);
        }
        return channelMock;
      });

    // Start the command
    const runPromise = command.run();

    // Send SIGINT after a short delay to trigger proper cleanup
    const cleanup = setTimeout(() => {
      process.emit("SIGINT", "SIGINT");
    }, timeoutMs);

    try {
      await runPromise;
    } catch {
      // Expected for some tests
    } finally {
      clearTimeout(cleanup);
      // Clean up any SIGINT listeners that weren't properly removed
      const newListeners = process.listeners("SIGINT");
      for (const listener of newListeners) {
        if (!originalListeners.includes(listener)) {
          process.removeListener("SIGINT", listener);
        }
      }
    }
  }

  it("should attempt to create an Ably client", async function () {
    const createClientStub = command.createAblyRealtimeClient as ReturnType<
      typeof vi.fn
    >;
    await runCommandAndSimulateLifecycle();
    expect(createClientStub).toHaveBeenCalledOnce();
  });

  it("should attempt to get and subscribe to a single channel", async function () {
    const channelMock = command.mockClient.channels.get();
    await runCommandAndSimulateLifecycle();
    expect(command.mockClient.channels.get).toHaveBeenCalledWith(
      "test-channel",
      {},
    );
    // Check subscribe was called *at least* once after attach simulation
    expect(channelMock.subscribe).toHaveBeenCalled();
  });

  it("should attempt to get and subscribe to multiple channels", async function () {
    const channelsToTest = ["channel1", "channel2", "channel3"];
    command.setParseResult({
      flags: {},
      args: { channels: channelsToTest },
      raw: [],
    });

    const channelMocks: Record<string, any> = {};
    channelsToTest.forEach((name) => {
      channelMocks[name] = {
        name: name,
        subscribe: vi.fn(),
        attach: vi.fn().mockImplementation(async () => {}),
        on: vi.fn(),
        unsubscribe: vi.fn(),
        detach: vi.fn().mockImplementation(async () => {}),
      };
    });

    // Use the original mock client's get stub setup in beforeEach, but make it return our specific mocks
    (
      command.mockClient.channels.get as ReturnType<typeof vi.fn>
    ).mockImplementation((name: string) => channelMocks[name]);

    await runCommandAndSimulateLifecycle(200);

    // Verify get was called for each channel
    expect(command.mockClient.channels.get).toHaveBeenCalledTimes(
      channelsToTest.length,
    );
    channelsToTest.forEach((name) => {
      expect(command.mockClient.channels.get).toHaveBeenCalledWith(name, {});
      expect(channelMocks[name].subscribe).toHaveBeenCalled();
    });
  });

  it("should pass channel options when flags are provided (rewind example)", async function () {
    const channelName = "rewind-channel";
    command.setParseResult({
      flags: { rewind: 5 },
      args: { channels: [channelName] },
      raw: [],
    });

    const channelMock = {
      name: channelName,
      subscribe: vi.fn(),
      attach: vi.fn().mockImplementation(async () => {}),
      on: vi.fn(),
      unsubscribe: vi.fn(),
      detach: vi.fn().mockImplementation(async () => {}),
    };
    (
      command.mockClient.channels.get as ReturnType<typeof vi.fn>
    ).mockReturnValue(channelMock);

    await runCommandAndSimulateLifecycle();

    expect(command.mockClient.channels.get).toHaveBeenCalledOnce();
    const getCall = command.mockClient.channels.get.mock.calls[0];
    expect(getCall[0]).toBe(channelName);
    expect(getCall[1]).toMatchObject({ params: { rewind: "5" } });
    expect(channelMock.subscribe).toHaveBeenCalled();
  });

  it("should throw error if no channel names provided", async function () {
    command.setParseResult({
      flags: {},
      args: { channels: [] },
      argv: [], // Ensure argv is empty too
      raw: [],
    });
    try {
      // No need to abort here, it should exit quickly
      await command.run();
      expect.fail("Command should have thrown an error for missing channels");
    } catch {
      // Check the error message stored by the overridden error method
      expect(command.errorOutput).toContain(
        "At least one channel name is required",
      );
    }
  });
});
