import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import * as Ably from "ably";

import BenchPublisher from "../../../../src/commands/bench/publisher.js";

// Lightweight testable subclass to intercept parsing and client creation
class TestableBenchPublisher extends BenchPublisher {
  private _parseResult: any;
  public mockRealtimeClient: any;

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  // Override parse to return the canned args/flags
  public override async parse() {
    return this._parseResult;
  }

  // Override Realtime client creation to supply our stub
  public override async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  // Skip app/key validation logic
  protected override async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  // Mock interactive helper for non-interactive unit testing
  protected override interactiveHelper = {
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
  } as any;

  // Override to suppress console clearing escape sequences during tests
  protected override shouldOutputJson(_flags?: any): boolean {
    // Force JSON output mode during tests to bypass console clearing
    return true;
  }
}

describe("bench publisher control envelopes", function () {
  let command: TestableBenchPublisher;
  let mockConfig: Config;
  let publishStub: ReturnType<typeof vi.fn>;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
    command = new TestableBenchPublisher([], mockConfig);

    publishStub = vi.fn().mockImplementation(async () => {});

    // Minimal mock channel
    const mockChannel = {
      publish: publishStub,
      subscribe: vi.fn(),
      presence: {
        enter: vi.fn().mockImplementation(async () => {}),
        get: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      },
      on: vi.fn(),
    };

    command.mockRealtimeClient = {
      channels: { get: vi.fn().mockReturnValue(mockChannel) },
      connection: { on: vi.fn(), state: "connected" },
      close: vi.fn(),
    };

    // Speed up test by stubbing out internal delay utility (3000 ms wait)
    vi.spyOn(command as any, "delay").mockImplementation(async () => {});

    command.setParseResult({
      flags: {
        transport: "realtime",
        messages: 2,
        rate: 2,
        "message-size": 50,
        "wait-for-subscribers": false,
      },
      args: { channel: "test-channel" },
      argv: [],
      raw: [],
    });
  });

  it("should publish start, message and end control envelopes in order", async function () {
    await command.run();

    // Extract the data argument from publish calls
    const publishedPayloads = publishStub.mock.calls.map((c) => c[1]);

    expect(publishedPayloads[0]).toHaveProperty("type", "start");

    // There should be at least one message payload with type "message"
    const messagePayload = publishedPayloads.find((p) => p.type === "message");
    expect(messagePayload).not.toBeUndefined();

    // Last payload should be end control
    const lastPayload = publishedPayloads.at(-1);
    expect(lastPayload).toHaveProperty("type", "end");
  });
});
