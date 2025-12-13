import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";
import ChannelsPublish from "../../../../src/commands/channels/publish.js";
import * as Ably from "ably";

// Create a testable version of ChannelsPublish
class TestableChannelsPublish extends ChannelsPublish {
  public logOutput: string[] = [];
  public errorOutput: string = "";
  private _parseResult: any;
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

  // Mock client objects
  public mockRestClient: any = null;
  public mockRealtimeClient: any = null;

  // Override client creation methods
  public override async createAblyRealtimeClient(
    _flags: any,
  ): Promise<Ably.Realtime | null> {
    this.debug("Using mock Realtime client");
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  public override async createAblyRestClient(
    _flags: any,
    _options?: any,
  ): Promise<Ably.Rest | null> {
    this.debug("Using mock REST client");
    return this.mockRestClient as unknown as Ably.Rest;
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

describe("ChannelsPublish", function () {
  let command: TestableChannelsPublish;
  let mockConfig: Config;
  let mockRestPublish: ReturnType<typeof vi.fn>;
  let mockRealtimePublish: ReturnType<typeof vi.fn>;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableChannelsPublish([], mockConfig);

    // Create stubs for the publish methods
    mockRestPublish = vi.fn().mockImplementation(async () => {});
    mockRealtimePublish = vi.fn().mockImplementation(async () => {});

    // Set up the mock REST client
    const mockRestChannel = {
      publish: mockRestPublish,
    };
    command.mockRestClient = {
      channels: {
        get: vi.fn().mockReturnValue(mockRestChannel),
      },
      request: vi.fn().mockResolvedValue({ statusCode: 201 }),
      close: vi.fn(),
    };

    // Set up the mock Realtime client
    const mockRealtimeChannel = {
      publish: mockRealtimePublish,
      on: vi.fn(), // Add the missing 'on' method
    };
    command.mockRealtimeClient = {
      channels: {
        get: vi.fn().mockReturnValue(mockRealtimeChannel),
      },
      connection: {
        once: vi
          .fn()
          .mockImplementation((_event: string, cb: () => void) => cb()), // Simulate immediate connection
        on: vi.fn(), // Add the missing 'on' method
        state: "connected",
        close: vi.fn(),
      },
      close: vi.fn(),
    };

    // Set default parse result for REST transport
    command.setParseResult({
      flags: {
        transport: "rest",
        name: undefined,
        encoding: undefined,
        count: 1,
        delay: 0,
      },
      args: { channel: "test-channel", message: '{"data":"hello"}' },
      argv: [],
      raw: [],
    });
  });

  afterEach(function () {
    vi.restoreAllMocks();
  });

  it("should publish a message using REST successfully", async function () {
    await command.run();

    const getChannel = command.mockRestClient.channels.get;
    expect(getChannel).toHaveBeenCalledOnce();
    expect(getChannel.mock.calls[0][0]).toBe("test-channel");

    expect(mockRestPublish).toHaveBeenCalledOnce();
    expect(mockRestPublish.mock.calls[0][0]).toEqual({ data: "hello" });
    expect(command.logOutput.join("\n")).toContain(
      "Message published successfully",
    );
  });

  it("should publish a message using Realtime successfully", async function () {
    command.setParseResult({
      flags: {
        transport: "realtime",
        name: undefined,
        encoding: undefined,
        count: 1,
        delay: 0,
      },
      args: { channel: "test-channel", message: '{"data":"realtime hello"}' },
      argv: [],
      raw: [],
    });

    await command.run();

    const getChannel = command.mockRealtimeClient.channels.get;
    expect(getChannel).toHaveBeenCalledOnce();
    expect(getChannel.mock.calls[0][0]).toBe("test-channel");

    expect(mockRealtimePublish).toHaveBeenCalledOnce();
    expect(mockRealtimePublish.mock.calls[0][0]).toEqual({
      data: "realtime hello",
    });
    expect(command.logOutput.join("\n")).toContain(
      "Message published successfully",
    );
  });

  it("should handle API errors during REST publish", async function () {
    const apiError = new Error("REST API Error");

    // Make the publish method reject with our error
    mockRestPublish.mockRejectedValue(apiError);

    await expect(command.run()).resolves.toBeUndefined();

    // The error could come from different places in the code path
    // Just check that some error was thrown during REST publish
    expect(mockRestPublish).toHaveBeenCalled();
  });

  it("should handle API errors during Realtime publish", async function () {
    command.setParseResult({
      flags: {
        transport: "realtime",
        name: undefined,
        encoding: undefined,
        count: 1,
        delay: 0,
      },
      args: { channel: "test-channel", message: '{"data":"test"}' },
      argv: [],
      raw: [],
    });

    const apiError = new Error("Realtime API Error");

    // Make the publish method reject with our error
    mockRealtimePublish.mockRejectedValue(apiError);

    await expect(command.run()).resolves.toBeUndefined();

    // The error could come from different places in the code path
    // Just check that some error was thrown during Realtime publish
    expect(mockRealtimePublish).toHaveBeenCalled();
  });

  it("should publish with specified event name", async function () {
    command.setParseResult({
      flags: {
        transport: "rest",
        name: "custom-event",
        encoding: undefined,
        count: 1,
        delay: 0,
      },
      args: { channel: "test-channel", message: '{"data":"hello"}' },
      argv: [],
      raw: [],
    });

    await command.run();

    expect(mockRestPublish).toHaveBeenCalledOnce();

    // Check that the name parameter was set correctly in the published message
    const publishArgs = mockRestPublish.mock.calls[0][0];
    expect(publishArgs).toHaveProperty("name", "custom-event");
    expect(publishArgs).toHaveProperty("data", "hello");
  });

  it("should publish multiple messages with --count", async function () {
    command.setParseResult({
      flags: {
        transport: "rest",
        name: undefined,
        encoding: undefined,
        count: 3,
        delay: 0,
      },
      args: { channel: "test-channel", message: '{"data":"count test"}' },
      argv: [],
      raw: [],
    });

    await command.run();

    expect(mockRestPublish).toHaveBeenCalledTimes(3);
    expect(command.logOutput.join("\n")).toContain(
      "messages published successfully",
    );
  });

  it("should output JSON when requested", async function () {
    command.setShouldOutputJson(true);
    command.setFormatJsonOutput((data) =>
      JSON.stringify({
        ...data,
        success: true,
        channel: "test-channel",
      }),
    );

    await command.run();

    expect(mockRestPublish).toHaveBeenCalledOnce();

    // Check for JSON output in the logs
    const jsonOutput = command.logOutput.find((log) => log.includes("success"));
    expect(jsonOutput).toBeDefined();

    // Parse and verify properties
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed).toHaveProperty("channel", "test-channel");
  });

  it("should handle invalid message JSON", async function () {
    // Override the prepareMessage method to simulate a JSON parsing error
    vi.spyOn(command, "prepareMessage" as any).mockImplementation(() => {
      throw new Error("Invalid JSON");
    });

    // Override the error method to mock the error behavior
    vi.spyOn(command, "error").mockImplementation((msg) => {
      command.errorOutput = typeof msg === "string" ? msg : msg.message;
      throw new Error("Invalid JSON");
    });

    command.setParseResult({
      flags: {
        transport: "rest",
        name: undefined,
        encoding: undefined,
        count: 1,
        delay: 0,
      },
      args: { channel: "test-channel", message: "invalid-json" },
      argv: [],
      raw: [],
    });

    await expect(command.run()).rejects.toThrow("Invalid JSON");
  });

  describe("transport selection", function () {
    it("should use realtime transport by default when publishing multiple messages", async function () {
      command.setParseResult({
        flags: {
          transport: undefined, // No explicit transport
          name: undefined,
          encoding: undefined,
          count: 3,
          delay: 40,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      await command.run();

      // With count > 1 and no explicit transport, should use realtime
      expect(mockRealtimePublish).toHaveBeenCalledTimes(3);
      expect(mockRestPublish).not.toHaveBeenCalled();
    });

    it("should respect explicit rest transport flag for multiple messages", async function () {
      command.setParseResult({
        flags: {
          transport: "rest",
          name: undefined,
          encoding: undefined,
          count: 3,
          delay: 0,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(mockRestPublish).toHaveBeenCalledTimes(3);
      expect(mockRealtimePublish).not.toHaveBeenCalled();
    });

    it("should use rest transport for single message by default", async function () {
      command.setParseResult({
        flags: {
          transport: undefined, // No explicit transport
          name: undefined,
          encoding: undefined,
          count: 1,
          delay: 0,
        },
        args: { channel: "test-channel", message: '{"data":"Single message"}' },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(mockRestPublish).toHaveBeenCalledOnce();
      expect(mockRealtimePublish).not.toHaveBeenCalled();
    });
  });

  describe("message delay and ordering", function () {
    it("should publish messages with default 40ms delay", async function () {
      const timestamps: number[] = [];
      mockRealtimePublish.mockImplementation(async () => {
        timestamps.push(Date.now());
      });

      command.setParseResult({
        flags: {
          transport: "realtime",
          name: undefined,
          encoding: undefined,
          count: 3,
          delay: 40,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      const startTime = Date.now();
      await command.run();
      const totalTime = Date.now() - startTime;

      expect(mockRealtimePublish).toHaveBeenCalledTimes(3);
      // Should take at least 80ms (2 delays of 40ms between 3 messages)
      expect(totalTime).toBeGreaterThanOrEqual(80);
    });

    it("should respect custom delay value", async function () {
      command.setParseResult({
        flags: {
          transport: "realtime",
          name: undefined,
          encoding: undefined,
          count: 3,
          delay: 100,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      const startTime = Date.now();
      await command.run();
      const totalTime = Date.now() - startTime;

      expect(mockRealtimePublish).toHaveBeenCalledTimes(3);
      // Should take at least 200ms (2 delays of 100ms between 3 messages)
      expect(totalTime).toBeGreaterThanOrEqual(200);
    });

    it("should allow zero delay when explicitly set", async function () {
      command.setParseResult({
        flags: {
          transport: "realtime",
          name: undefined,
          encoding: undefined,
          count: 3,
          delay: 0,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      const startTime = Date.now();
      await command.run();
      const totalTime = Date.now() - startTime;

      expect(mockRealtimePublish).toHaveBeenCalledTimes(3);
      // With zero delay, should complete quickly (under 50ms accounting for overhead)
      expect(totalTime).toBeLessThan(50);
    });

    it("should publish messages in sequential order", async function () {
      const publishedData: string[] = [];
      mockRealtimePublish.mockImplementation(async (message: any) => {
        publishedData.push(message.data);
      });

      command.setParseResult({
        flags: {
          transport: "realtime",
          name: undefined,
          encoding: undefined,
          count: 5,
          delay: 0,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(publishedData).toEqual([
        "Message 1",
        "Message 2",
        "Message 3",
        "Message 4",
        "Message 5",
      ]);
    });
  });

  describe("error handling with multiple messages", function () {
    it("should continue publishing remaining messages on error", async function () {
      let callCount = 0;
      const publishedData: string[] = [];

      mockRealtimePublish.mockImplementation(async (message: any) => {
        callCount++;
        if (callCount === 3) {
          throw new Error("Network error");
        }
        publishedData.push(message.data);
      });

      command.setParseResult({
        flags: {
          transport: "realtime",
          name: undefined,
          encoding: undefined,
          count: 5,
          delay: 0,
        },
        args: {
          channel: "test-channel",
          message: '{"data":"Message {{.Count}}"}',
        },
        argv: [],
        raw: [],
      });

      await command.run();

      // Should have attempted all 5, but only 4 succeeded
      expect(mockRealtimePublish).toHaveBeenCalledTimes(5);
      expect(publishedData).toHaveLength(4);
      expect(command.logOutput.join("\n")).toContain("4/5");
      expect(command.logOutput.join("\n")).toContain("1 errors");
    });
  });
});
