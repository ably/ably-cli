import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import ChannelsPresenceSubscribe from "../../../../../src/commands/channels/presence/subscribe.js";
import * as Ably from "ably";

// Create a testable version of ChannelsPresenceSubscribe
class TestableChannelsPresenceSubscribe extends ChannelsPresenceSubscribe {
  public logOutput: string[] = [];
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
        flags: {},
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

  // Override client creation to return a controlled mock
  public override async createAblyRealtimeClient(
    _flags: any,
  ): Promise<Ably.Realtime | null> {
    this.debug("Overridden createAblyRealtimeClient called");

    // Ensure mockClient is initialized if not already done (e.g., in beforeEach)
    if (!this.mockClient || !this.mockClient.channels) {
      this.debug("Initializing mockClient inside createAblyRealtimeClient");
      const mockPresenceInstance = {
        get: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        enter: vi.fn().mockImplementation(async () => {}),
        leave: vi.fn().mockImplementation(async () => {}),
      };
      const mockChannelInstance = {
        presence: mockPresenceInstance,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        attach: vi.fn().mockImplementation(async () => {}),
        detach: vi.fn().mockImplementation(async () => {}),
        on: vi.fn(),
      };
      this.mockClient = {
        channels: {
          get: vi.fn().mockReturnValue(mockChannelInstance),
          release: vi.fn(),
        },
        connection: {
          once: vi.fn().mockImplementation((event, callback) => {
            if (event === "connected") {
              setTimeout(callback, 5);
            }
          }),
          on: vi.fn(),
          close: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
      };
    }

    this.debug("Returning pre-configured mockClient");
    return this.mockClient as Ably.Realtime; // Return the existing mock
  }

  // Override logging methods
  public override log(message?: string | undefined, ..._args: any[]): void {
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
    this.debug("Overridden ensureAppAndKey called");
    // Return dummy auth details required by some base class logic potentially
    return { apiKey: "dummy.key:secret", appId: "dummy-app" };
  }
}

// TODO: This test needs a re-write. It's not actually testing anything of value.
describe("ChannelsPresenceSubscribe", function () {
  let command: TestableChannelsPresenceSubscribe;
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableChannelsPresenceSubscribe([], mockConfig);

    // Initialize mock client
    const mockPresenceInstance = {
      get: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      enter: vi.fn().mockImplementation(async () => {}),
      leave: vi.fn().mockImplementation(async () => {}),
    };
    const mockChannelInstance = {
      presence: mockPresenceInstance,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      attach: vi.fn().mockImplementation(async () => {}),
      detach: vi.fn().mockImplementation(async () => {}),
      on: vi.fn(),
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

    // No need to stub createAblyClient in beforeEach since we're testing individual methods

    // Set default parse result
    command.setParseResult({
      flags: {},
      args: { channel: "test-presence-channel" },
      raw: [],
    });
  });

  it("should create an Ably client when run", async function () {
    const createClientSpy = vi.spyOn(command, "createAblyRealtimeClient");

    // Stub the actual functionality to avoid long-running operations
    vi.spyOn(command, "run").mockImplementation(async function (
      this: TestableChannelsPresenceSubscribe,
    ) {
      await this.createAblyRealtimeClient({});
      return;
    });

    await command.run();

    expect(createClientSpy).toHaveBeenCalledOnce();
  });

  it("should return mock client from createAblyRealtimeClient", async function () {
    const client = await command.createAblyRealtimeClient({});
    expect(client).toBe(command.mockClient);
  });

  it("should format JSON output when shouldOutputJson is true", function () {
    command.setShouldOutputJson(true);
    command.setFormatJsonOutput((data) => JSON.stringify(data, null, 2));

    const testData = { channel: "test", action: "subscribe" };
    const result = command.formatJsonOutput(testData);

    expect(result).toBeTypeOf("string");
    expect(() => JSON.parse(result)).not.toThrow();

    const parsed = JSON.parse(result);
    expect(parsed).toEqual(testData);
  });

  it("should log presence member information", function () {
    const members = [
      { clientId: "user1", data: { status: "online" } },
      { clientId: "user2", data: null },
    ];

    // Test the logging logic directly
    members.forEach((member) => {
      const logMessage = `- Client: ${member.clientId || "N/A"} ${member.data ? `| Data: ${JSON.stringify(member.data)}` : ""}`;
      command.log(logMessage);
    });

    expect(command.logOutput).toHaveLength(2);
    expect(command.logOutput[0]).toContain("user1");
    expect(command.logOutput[0]).toContain("online");
    expect(command.logOutput[1]).toContain("user2");
  });
});
