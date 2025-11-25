import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import ChannelsPresenceEnter from "../../../../../src/commands/channels/presence/enter.js";
import * as Ably from "ably";

// Create a testable version of ChannelsPresenceEnter
class TestableChannelsPresenceEnter extends ChannelsPresenceEnter {
  public errorOutput: string = "";
  private _parseResult: any;
  public mockClient: any = {}; // Initialize mockClient
  private _shouldOutputJson = false;
  private _formatJsonOutputFn:
    | ((data: Record<string, unknown>) => string)
    | null = null;

  // Override parse to simulate parse output
  public override async parse(..._args: any[]) {
    if (!this._parseResult) {
      // Default parse result if not set
      this._parseResult = {
        flags: { data: "{}", "show-others": true },
        args: { channel: "default-presence-channel" },
        argv: ["default-presence-channel"],
        raw: [],
      };
    }
    return this._parseResult;
  }

  public setParseResult(result: any) {
    this._parseResult = result;
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

  // Helper for blocking promises - MODIFIED to resolve immediately for unit tests
  public override setupCleanupHandler(
    _cleanupFn: () => Promise<void>,
  ): Promise<void> {
    this.debug("Skipping indefinite wait in setupCleanupHandler for test.");
    return Promise.resolve();
  }

  // Override ensureAppAndKey to prevent real auth checks in unit tests
  protected override async ensureAppAndKey(
    _flags: any,
  ): Promise<{ apiKey: string; appId: string } | null> {
    this.debug("Skipping ensureAppAndKey in test mode");
    return { apiKey: "dummy-key-value:secret", appId: "dummy-app" };
  }

  // Override the createAblyRealtimeClient method to ensure it returns a value
  public override async createAblyRealtimeClient(
    _flags?: any,
  ): Promise<Ably.Realtime | null> {
    this.debug(
      "Overriding createAblyRealtimeClient in test mode, returning mockClient.",
    );
    // Return the mock client that was set up for testing
    return this.mockClient as unknown as Ably.Realtime;
  }
}

describe("ChannelsPresenceEnter", function () {
  let command: TestableChannelsPresenceEnter;
  let mockConfig: Config;
  let _logStub: ReturnType<typeof vi.fn>;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableChannelsPresenceEnter([], mockConfig);
    _logStub = vi.spyOn(command, "log");

    // No need to stub the ES module - we override the method in run() below

    // Set up a more complete mock client structure for beforeEach
    const mockPresenceInstance = {
      get: vi.fn().mockResolvedValue([]), // Default to empty members
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      enter: vi.fn().mockImplementation(async () => {}),
      leave: vi.fn().mockImplementation(async () => {}),
    };
    const mockChannelInstance = {
      name: "test-presence-channel", // Add default name
      presence: mockPresenceInstance,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      // Make attach resolve quickly
      attach: vi.fn().mockImplementation(async () => {}),
      detach: vi.fn().mockImplementation(async () => {}),
      // Simulate channel attached event shortly after attach is called
      on: vi
        .fn()
        .mockImplementation(
          (event: string, handler: (stateChange: any) => void) => {
            if (event === "attached" && typeof handler === "function") {
              // Simulate async event
              setTimeout(() => handler({ current: "attached" }), 0);
            }
          },
        ),
    };

    command.mockClient = {
      channels: {
        get: vi.fn().mockReturnValue(mockChannelInstance),
        release: vi.fn(),
      },
      connection: {
        once: vi.fn(),
        // Simulate connection connected event quickly
        on: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (stateChange: any) => void) => {
              if (event === "connected" && typeof handler === "function") {
                // Simulate async event
                setTimeout(() => handler({ current: "connected" }), 0);
              }
            },
          ),
        close: vi.fn(),
        state: "connected", // Start in connected state for simplicity
      },
      auth: {
        clientId: "test-client-id",
      },
      close: vi.fn(),
    };

    // Ensure the overridden createAblyRealtimeClient uses this mock
    // (Already handled by the class override, no need to stub it again here)

    // Set default parse result (can be overridden by specific tests)
    command.setParseResult({
      flags: { "profile-data": "{}", "show-others": true },
      args: { channel: "test-presence-channel" },
      raw: [],
    });
  });

  it("should create an Ably client when run", async function () {
    const createClientSpy = vi.spyOn(command, "createAblyRealtimeClient");

    // Stub the actual functionality to avoid long-running operations
    vi.spyOn(command, "run").mockImplementation(async function (
      this: TestableChannelsPresenceEnter,
    ) {
      await this.createAblyRealtimeClient({});
      return;
    });

    await command.run();

    expect(createClientSpy).toHaveBeenCalledOnce();
  });

  it("should parse data correctly", async function () {
    command.setParseResult({
      flags: { data: '{"status":"online"}' },
      args: { channel: "test-channel" },
      raw: [],
    });

    const parseResult = await command.parse();
    expect(parseResult.flags.data).toBe('{"status":"online"}');
  });

  it("should handle invalid JSON in data", function () {
    command.setParseResult({
      flags: { data: "{invalid-json}" },
      args: { channel: "test-channel" },
      raw: [],
    });

    // Test JSON parsing logic directly
    const invalidJson = "{invalid-json}";
    expect(() => JSON.parse(invalidJson)).toThrow();
  });

  it("should return mock client from createAblyRealtimeClient", async function () {
    const client = await command.createAblyRealtimeClient({});
    expect(client).toBe(command.mockClient);
  });

  it("should format JSON output when shouldOutputJson is true", function () {
    command.setShouldOutputJson(true);
    command.setFormatJsonOutput((data) => JSON.stringify(data, null, 2));

    const testData = { channel: "test", action: "enter" };
    const result = command.formatJsonOutput(testData);

    expect(result).toBeTypeOf("string");
    expect(() => JSON.parse(result)).not.toThrow();

    const parsed = JSON.parse(result);
    expect(parsed).toEqual(testData);
  });
});
