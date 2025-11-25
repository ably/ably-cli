import { describe, it, expect, beforeEach, vi } from "vitest";
import BatchPublish from "../../../../src/commands/channels/batch-publish.js";

// Create a testable version of the BatchPublish command class
class TestableBatchPublish extends BatchPublish {
  // Override parse to return a predefined result for testing
  public override async parse() {
    // Return the parse result that was set via our test setup
    return this._parseResult;
  }

  // Add a property to store the parse result for testing
  private _parseResult: any = {
    flags: { channels: "test-channel-1,test-channel-2" },
    args: { message: '{"data":"test message"}' },
    argv: [],
    raw: [],
  };

  // Method to set parse result for testing
  public setParseResult(result: any) {
    this._parseResult = result;
  }

  // Override createAblyRestClient to return our mock
  public override async createAblyRestClient(
    _flags: any,
    _options?: any,
  ): Promise<any> {
    return this._mockAblyClient as any;
  }

  // Add override for getClientOptions to bypass authentication checks
  protected override getClientOptions(_flags: any): any {
    return { key: "fake.key:secret" };
  }

  private _mockAblyClient: any = {
    close: () => {},
    channels: {
      get: (_channelName: string) => {
        // Return the mock channel for this channel name
        return {
          publish:
            this._mockPublish ?? vi.fn().mockImplementation(async () => {}),
        };
      },
    },
  };

  private _mockPublish: ReturnType<typeof vi.fn>;

  // Method to set the mock Ably client
  public setMockAblyClient(client: any) {
    this._mockAblyClient = client;
  }

  // Method to set the mock publish function
  public setMockPublish(publishFn: any) {
    this._mockPublish = publishFn;
  }

  // Override shouldOutputJson
  public override shouldOutputJson(_flags: any) {
    return this._shouldOutputJson;
  }

  private _shouldOutputJson = false;

  // Method to set shouldOutputJson value
  public setShouldOutputJson(value: boolean) {
    this._shouldOutputJson = value;
  }

  // Override formatJsonOutput
  public override formatJsonOutput(data: Record<string, unknown>, _flags: any) {
    return this._formatJsonOutputFn
      ? this._formatJsonOutputFn(data)
      : JSON.stringify(data);
  }

  private _formatJsonOutputFn:
    | ((data: Record<string, unknown>) => string)
    | null = null;

  // Method to set formatJsonOutput function
  public setFormatJsonOutput(fn: (data: Record<string, unknown>) => string) {
    this._formatJsonOutputFn = fn;
  }

  // Mock log method for testing output
  public logOutput: string[] = [];
  public override log(message: string) {
    this.logOutput.push(message);
  }

  // Mock error method for testing errors
  public errorOutput: string | null = null;
  public error(message: string | Error, _options?: any): never {
    this.errorOutput = typeof message === "string" ? message : message.message;
    throw new Error(this.errorOutput);
  }

  // Mock method for reading file content
  public mockFileContent: string | null = null;
  protected async readFile(_filePath: string): Promise<string> {
    if (this.mockFileContent === null) {
      throw new Error("No mock file content set");
    }
    return this.mockFileContent;
  }

  // Method to set mock file content
  public setMockFileContent(content: string) {
    this.mockFileContent = content;
  }

  // Add request property for testing REST API calls
  public request: ReturnType<typeof vi.fn> = vi.fn();
}

describe("Channels Batch Publish Command", function () {
  let command: TestableBatchPublish;
  beforeEach(function () {
    command = new TestableBatchPublish([], {} as any);
  });

  it("handles errors during batch publishing", async function () {
    const publishError = new Error("Publish failed");
    command.setMockPublish(vi.fn().mockRejectedValue(publishError));

    try {
      await command.run();
      // Should not reach here
      expect.fail("Should have thrown an error");
    } catch {
      expect(command.errorOutput).toContain("Failed to execute batch publish");
    }
  });

  it("handles invalid channels input", async function () {
    command.setParseResult({
      flags: {},
      args: { message: '{"data":"test message"}' },
      argv: [],
      raw: [],
    });

    try {
      await command.run();
      // Should not reach here
      expect.fail("Should have thrown an error");
    } catch {
      expect(command.errorOutput).toContain(
        "You must specify either --channels, --channels-json, or --spec",
      );
    }
  });

  it("handles message publishing with custom event name", async function () {
    // Prepare a successful mock response
    const messageIds = ["message1", "message2"];
    const mockItems = messageIds.map((id) => ({
      messageId: id,
      channel: "test-channel",
    }));

    // Create a mock REST client with a request method that returns success
    const mockRest = {
      request: vi.fn().mockResolvedValue({
        statusCode: 201,
        items: mockItems,
        success: true,
      }),
    };

    // Set the mock client
    command.setMockAblyClient(mockRest);

    // Set up command parse result for custom event name
    command.setParseResult({
      flags: {
        channels: "test-channel", // Use the channels flag
        name: "custom-event", // Use name flag for event name
      },
      args: {
        message: '{"data":"test message"}', // Message as args
      },
      argv: [],
      raw: [],
    });

    await command.run();

    // Verify the request was called on our mock client
    expect(mockRest.request).toHaveBeenCalled();

    // Verify the request was called with correct parameters
    const requestCallArgs = mockRest.request.mock.calls[0];
    expect(requestCallArgs[0]).toBe("post");
    expect(requestCallArgs[1]).toBe("/messages");

    // Verify the log shows success
    expect(command.logOutput.length).toBeGreaterThan(0);
    expect(command.logOutput[0]).toContain("Sending batch publish request");
  });
});
