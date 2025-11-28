import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import ChannelsOccupancyGet from "../../../../../src/commands/channels/occupancy/get.js";
import * as Ably from "ably";

// Create a testable version of ChannelsOccupancyGet
class TestableChannelsOccupancyGet extends ChannelsOccupancyGet {
  public logOutput: string[] = [];
  public errorOutput: string = "";
  private _parseResult: any;
  private _shouldOutputJson = false;
  private _formatJsonOutputFn:
    | ((data: Record<string, unknown>) => string)
    | null = null;

  // Mock REST client for testing
  public mockClient: any = {
    request: vi.fn(),
  };

  // Override parse to return test data
  public override async parse() {
    return (
      this._parseResult || {
        flags: {},
        args: { channel: "test-channel" },
        argv: [],
        raw: [],
      }
    );
  }

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  // Override getClientOptions to return test options
  public override getClientOptions(_flags: any): Ably.ClientOptions {
    return { key: "test:key" };
  }

  // Override createAblyRestClient to return mock client
  public override async createAblyRestClient(
    _flags: any,
    _options?: any,
  ): Promise<Ably.Rest | null> {
    return this.mockClient as any;
  }

  // Override logging methods
  public override log(message: string): void {
    this.logOutput.push(message);
  }

  public override error(message: string | Error): never {
    this.errorOutput = typeof message === "string" ? message : message.message;
    throw new Error(this.errorOutput);
  }

  // JSON output methods
  public override shouldOutputJson(_flags?: any): boolean {
    return this._shouldOutputJson;
  }

  public setShouldOutputJson(value: boolean) {
    this._shouldOutputJson = value;
  }

  public override formatJsonOutput(data: Record<string, unknown>): string {
    return this._formatJsonOutputFn
      ? this._formatJsonOutputFn(data)
      : JSON.stringify(data);
  }

  public setFormatJsonOutput(fn: (data: Record<string, unknown>) => string) {
    this._formatJsonOutputFn = fn;
  }

  // Override ensureAppAndKey to prevent auth checks
  protected override async ensureAppAndKey(
    _flags: any,
  ): Promise<{ apiKey: string; appId: string } | null> {
    return { apiKey: "test:key", appId: "test-app" };
  }
}

describe("ChannelsOccupancyGet", function () {
  let command: TestableChannelsOccupancyGet;
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableChannelsOccupancyGet([], mockConfig);

    // Set default parse result
    command.setParseResult({
      flags: {},
      args: { channel: "test-occupancy-channel" },
      argv: [],
      raw: [],
    });

    // Set up mock behavior for REST request
    command.mockClient.request.mockResolvedValue({
      items: [
        {
          status: {
            occupancy: {
              metrics: {
                connections: 10,
                presenceConnections: 5,
                presenceMembers: 8,
                presenceSubscribers: 4,
                publishers: 2,
                subscribers: 6,
              },
            },
          },
        },
      ],
    });
  });

  it("should successfully retrieve and display occupancy using REST API", async function () {
    await command.run();

    // Check that request was called with the right parameters
    expect(command.mockClient.request).toHaveBeenCalledOnce();
    const [method, path, version, params, body] =
      command.mockClient.request.mock.calls[0];
    expect(method).toBe("get");
    expect(path).toBe("/channels/test-occupancy-channel");
    expect(version).toBe(2);
    expect(params).toEqual({ occupancy: "metrics" });
    expect(body).toBeNull();

    // Check for expected output in logs
    const output = command.logOutput.join("\n");
    expect(output).toContain("test-occupancy-channel");
    expect(output).toContain("Connections: 10");
    expect(output).toContain("Presence Connections: 5");
    expect(output).toContain("Presence Members: 8");
    expect(output).toContain("Presence Subscribers: 4");
    expect(output).toContain("Publishers: 2");
    expect(output).toContain("Subscribers: 6");
  });

  it("should output occupancy in JSON format when requested", async function () {
    command.setShouldOutputJson(true);
    command.setFormatJsonOutput((data) => JSON.stringify(data));

    await command.run();

    // Find the JSON output in logs
    const jsonOutput = command.logOutput.find((log) => log.startsWith("{"));
    expect(jsonOutput).toBeDefined();

    // Parse and verify the JSON output
    const parsedOutput = JSON.parse(jsonOutput!);
    expect(parsedOutput).toHaveProperty("channel", "test-occupancy-channel");
    expect(parsedOutput).toHaveProperty("metrics");
    expect(parsedOutput.metrics).toMatchObject({
      connections: 10,
      presenceConnections: 5,
      presenceMembers: 8,
      presenceSubscribers: 4,
      publishers: 2,
      subscribers: 6,
    });
    expect(parsedOutput).toHaveProperty("success", true);
  });

  it("should handle empty occupancy metrics", async function () {
    // Override mock to return empty metrics
    command.mockClient.request.mockResolvedValue({
      occupancy: {
        metrics: null,
      },
    });

    await command.run();

    // Check for expected output with zeros
    const output = command.logOutput.join("\n");
    expect(output).toContain("test-occupancy-channel");
    expect(output).toContain("Connections: 0");
    expect(output).toContain("Publishers: 0");
    expect(output).toContain("Subscribers: 0");
  });
});
