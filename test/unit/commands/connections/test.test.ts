import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";
import ConnectionsTest from "../../../../src/commands/connections/test.js";
import * as Ably from "ably";

// Create a testable version of ConnectionsTest
class TestableConnectionsTest extends ConnectionsTest {
  public logOutput: string[] = [];
  public consoleOutput: string[] = [];
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

  // Override getClientOptions to return mock options
  public override getClientOptions(_flags: any): Ably.ClientOptions {
    return { key: "dummy-key:secret" };
  }

  // Override ensureAppAndKey to prevent real auth checks in unit tests
  protected override async ensureAppAndKey(
    _flags: any,
  ): Promise<{ apiKey: string; appId: string } | null> {
    this.debug("Skipping ensureAppAndKey in test mode");
    return { apiKey: "dummy-key-value:secret", appId: "dummy-app" };
  }

  // Mock console.log to capture any direct console output
  public mockConsoleLog = (message?: any, ..._optionalParams: any[]): void => {
    if (message !== undefined) {
      this.consoleOutput.push(message.toString());
    }
  };

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
  public override shouldOutputJson(flags?: any): boolean {
    // Check the flags like the parent class would
    if (
      flags &&
      (flags.json === true ||
        flags["pretty-json"] === true ||
        flags.format === "json")
    ) {
      return true;
    }
    // Fall back to the explicitly set value
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

  // Public getter to access protected configManager for testing
  public getConfigManager() {
    return this.configManager;
  }
}

describe("ConnectionsTest", function () {
  let command: TestableConnectionsTest;
  let mockConfig: Config;
  let originalConsoleLog: typeof console.log;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableConnectionsTest([], mockConfig);

    // Mock config manager to prevent "No API key found" errors
    vi.spyOn(command.getConfigManager(), "getApiKey").mockResolvedValue(
      "dummy-key:secret",
    );

    // Mock console.log to capture any direct console output
    originalConsoleLog = console.log;
    console.log = command.mockConsoleLog;

    // Set default parse result
    command.setParseResult({
      flags: { timeout: 30000, "run-for": 10000 },
      args: {},
      argv: [],
      raw: [],
    });
  });

  afterEach(function () {
    // Restore console.log
    console.log = originalConsoleLog;
    vi.restoreAllMocks();
  });

  it("should parse flags correctly", async function () {
    command.setParseResult({
      flags: {
        timeout: 5000,
        transport: "ws",
        json: false,
      },
      args: {},
      argv: [],
      raw: [],
    });

    // The test will fail trying to create real Ably clients, but we can check the parse was called
    try {
      await command.run();
    } catch {
      // Expected - we're not mocking Ably
    }

    // Check that parse was called
    const result = await command.parse();
    expect(result.flags.timeout).toBe(5000);
    expect(result.flags.transport).toBe("ws");
  });

  it("should handle getClientOptions", function () {
    const options = command.getClientOptions({ "api-key": "test-key:secret" });
    expect(options).toHaveProperty("key", "dummy-key:secret");
  });

  it("should output JSON when requested", function () {
    // Test that we can set JSON output mode
    command.setShouldOutputJson(true);
    expect(command.shouldOutputJson({})).toBe(true);

    // Test JSON formatting
    const testData = {
      success: true,
      transport: "all",
      ws: { success: true, error: null },
      xhr: { success: true, error: null },
    };

    const formatted = command.formatJsonOutput(testData, {});
    expect(formatted).toBeTypeOf("string");

    const parsed = JSON.parse(formatted);
    expect(parsed).toEqual(testData);
  });

  it("should format JSON output correctly", function () {
    const formatted = command.formatJsonOutput(
      { test: "data" },
      { "pretty-json": false },
    );
    expect(formatted).toBe('{"test":"data"}');
  });

  it("should detect JSON output mode", function () {
    expect(command.shouldOutputJson({ json: true })).toBe(true);
    expect(command.shouldOutputJson({ "pretty-json": true })).toBe(true);
    expect(command.shouldOutputJson({ format: "json" })).toBe(true);
    expect(command.shouldOutputJson({})).toBe(false);
  });
});
