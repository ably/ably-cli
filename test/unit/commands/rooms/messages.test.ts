import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import * as Ably from "ably";

import RoomsMessagesSend from "../../../../src/commands/rooms/messages/send.js";
import RoomsMessagesSubscribe from "../../../../src/commands/rooms/messages/subscribe.js";
import RoomsMessagesHistory from "../../../../src/commands/rooms/messages/history.js";

// Testable subclass for rooms messages send command
class TestableRoomsMessagesSend extends RoomsMessagesSend {
  private _parseResult: any;
  public mockChatClient: any;
  public mockRealtimeClient: any;

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  public override async parse() {
    return this._parseResult;
  }

  protected override async createChatClient(_flags: any) {
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.mockRealtimeClient;
    return this.mockChatClient;
  }

  protected override async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  protected override async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  protected override interactiveHelper = {
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
  } as any;
}

// Testable subclass for rooms messages subscribe command
class TestableRoomsMessagesSubscribe extends RoomsMessagesSubscribe {
  private _parseResult: any;
  public mockChatClient: any;
  public mockRealtimeClient: any;
  public logOutput: string[] = [];

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  public override async parse() {
    return this._parseResult;
  }

  public override log(message?: string | undefined): void {
    const plainMessage =
      typeof message === "string" ? message : String(message);
    this.logOutput.push(plainMessage);
  }

  protected override async createChatClient(_flags: any) {
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.mockRealtimeClient;
    return this.mockChatClient;
  }

  protected override async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  protected override async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  protected override interactiveHelper = {
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
  } as any;
}

// Testable subclass for rooms messages history command
class TestableRoomsMessagesHistory extends RoomsMessagesHistory {
  private _parseResult: any;
  public mockChatClient: any;
  public mockRealtimeClient: any;

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  public override async parse() {
    return this._parseResult;
  }

  protected override async createChatClient(_flags: any) {
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.mockRealtimeClient;
    return this.mockChatClient;
  }

  protected override async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  protected override async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  protected override interactiveHelper = {
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
  } as any;
}

describe("rooms messages commands", function () {
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
  });

  describe("rooms messages send", function () {
    let command: TestableRoomsMessagesSend;
    let mockRoom: any;
    let mockMessages: any;
    let sendStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsMessagesSend([], mockConfig);

      sendStub = vi.fn().mockImplementation(async () => {});
      mockMessages = {
        send: sendStub,
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        messages: mockMessages,
        onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          off: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
      };

      command.mockChatClient = {
        rooms: {
          get: vi.fn().mockResolvedValue(mockRoom),
          release: vi.fn().mockImplementation(async () => {}),
        },
        connection: {
          onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
        },
        realtime: command.mockRealtimeClient,
      };

      command.setParseResult({
        flags: {},
        args: { room: "test-room", text: "Hello World" },
        argv: [],
        raw: [],
      });
    });

    it("should send a single message successfully", async function () {
      await command.run();

      expect(sendStub).toHaveBeenCalledOnce();
      expect(sendStub.mock.calls[0][0]).toEqual({
        text: "Hello World",
      });
      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
    });

    it("should send multiple messages with interpolation", async function () {
      command.setParseResult({
        flags: { count: 3, delay: 10 },
        args: { room: "test-room", text: "Message {{.Count}}" },
        argv: [],
        raw: [],
      });

      await command.run();

      // Should eventually send 3 messages
      expect(sendStub).toHaveBeenCalledTimes(3);

      // Check first and last calls for interpolation
      const firstCallArgs = sendStub.mock.calls[0];
      const lastCallArgs = sendStub.mock.calls[2];

      expect(firstCallArgs[0].text).toBe("Message 1");
      expect(lastCallArgs[0].text).toBe("Message 3");
    });

    it("should handle metadata in messages", async function () {
      command.setParseResult({
        flags: { metadata: '{"isImportant": true}' },
        args: { room: "test-room", text: "Important message" },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(sendStub).toHaveBeenCalledOnce();
      expect(sendStub.mock.calls[0][0]).toEqual({
        text: "Important message",
        metadata: { isImportant: true },
      });
    });

    it("should handle invalid metadata JSON", async function () {
      command.setParseResult({
        flags: { metadata: "invalid-json" },
        args: { room: "test-room", text: "Test message" },
        argv: [],
        raw: [],
      });

      await expect(command.run()).rejects.toThrow("Invalid metadata JSON");
    });

    describe("message delay and ordering", function () {
      it("should send messages with default 40ms delay", async function () {
        command.setParseResult({
          flags: { count: 3, delay: 40 },
          args: { room: "test-room", text: "Message {{.Count}}" },
          argv: [],
          raw: [],
        });

        const startTime = Date.now();
        await command.run();
        const totalTime = Date.now() - startTime;

        expect(sendStub).toHaveBeenCalledTimes(3);
        // Should take at least 80ms (2 delays of 40ms between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(80);
      });

      it("should respect custom delay value", async function () {
        command.setParseResult({
          flags: { count: 3, delay: 100 },
          args: { room: "test-room", text: "Message {{.Count}}" },
          argv: [],
          raw: [],
        });

        const startTime = Date.now();
        await command.run();
        const totalTime = Date.now() - startTime;

        expect(sendStub).toHaveBeenCalledTimes(3);
        // Should take at least 200ms (2 delays of 100ms between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(200);
      });

      it("should enforce minimum 40ms delay even if lower value specified", async function () {
        command.setParseResult({
          flags: { count: 3, delay: 10 }, // Below minimum
          args: { room: "test-room", text: "Message {{.Count}}" },
          argv: [],
          raw: [],
        });

        const startTime = Date.now();
        await command.run();
        const totalTime = Date.now() - startTime;

        expect(sendStub).toHaveBeenCalledTimes(3);
        // Should take at least 80ms (minimum 40ms delay enforced)
        expect(totalTime).toBeGreaterThanOrEqual(80);
      });

      it("should send messages in sequential order", async function () {
        const sentTexts: string[] = [];
        sendStub.mockImplementation(async (message: any) => {
          sentTexts.push(message.text);
        });

        command.setParseResult({
          flags: { count: 5, delay: 10 },
          args: { room: "test-room", text: "Message {{.Count}}" },
          argv: [],
          raw: [],
        });

        await command.run();

        expect(sentTexts).toEqual([
          "Message 1",
          "Message 2",
          "Message 3",
          "Message 4",
          "Message 5",
        ]);
      });
    });

    describe("error handling with multiple messages", function () {
      it("should continue sending remaining messages on error", async function () {
        let callCount = 0;
        const sentTexts: string[] = [];

        sendStub.mockImplementation(async (message: any) => {
          callCount++;
          if (callCount === 3) {
            throw new Error("Network error");
          }
          sentTexts.push(message.text);
        });

        command.setParseResult({
          flags: { count: 5, delay: 10 },
          args: { room: "test-room", text: "Message {{.Count}}" },
          argv: [],
          raw: [],
        });

        await command.run();

        // Should have attempted all 5, but only 4 succeeded
        expect(sendStub).toHaveBeenCalledTimes(5);
        expect(sentTexts).toHaveLength(4);
      });
    });
  });

  describe("rooms messages subscribe", function () {
    let command: TestableRoomsMessagesSubscribe;
    let mockRoom: any;
    let mockMessages: any;
    let subscribeStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsMessagesSubscribe([], mockConfig);

      subscribeStub = vi.fn();
      mockMessages = {
        subscribe: subscribeStub,
        unsubscribe: vi.fn().mockImplementation(async () => {}),
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        messages: mockMessages,
        onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          off: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
      };

      command.mockChatClient = {
        rooms: {
          get: vi.fn().mockResolvedValue(mockRoom),
          release: vi.fn().mockImplementation(async () => {}),
        },
        connection: {
          onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
        },
        realtime: command.mockRealtimeClient,
      };

      command.setParseResult({
        flags: {},
        args: { rooms: "test-room" },
        argv: ["test-room"],
        raw: [],
      });
    });

    it("should subscribe to room messages and display received message content", async function () {
      // Mock the subscription to capture callback and simulate receiving a message
      let messageCallback: ((event: unknown) => void) | null = null;
      subscribeStub.mockImplementation((callback) => {
        messageCallback = callback;
        return Promise.resolve();
      });

      // Start the command
      command.run();

      // Give it a moment to set up
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
        {},
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(subscribeStub).toHaveBeenCalledOnce();

      // Simulate receiving a message
      expect(messageCallback).not.toBeNull();
      messageCallback!({
        message: {
          text: "Hello from chat",
          clientId: "sender-client",
          timestamp: new Date(),
        },
      });

      // Give time for the message to be processed
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify the message content was logged
      const allOutput = command.logOutput.join("\n");
      expect(allOutput).toContain("sender-client");
      expect(allOutput).toContain("Hello from chat");

      // Cleanup - this would normally be done by SIGINT
      command.mockRealtimeClient.close();
    });
  });

  describe("rooms messages history", function () {
    let command: TestableRoomsMessagesHistory;
    let mockRoom: any;
    let mockMessages: any;
    let historyStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsMessagesHistory([], mockConfig);

      historyStub = vi.fn().mockResolvedValue({
        items: [
          {
            text: "Historical message 1",
            clientId: "client1",
            timestamp: new Date(Date.now() - 10000),
          },
          {
            text: "Historical message 2",
            clientId: "client2",
            timestamp: new Date(Date.now() - 5000),
          },
        ],
      });

      mockMessages = {
        history: historyStub,
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        messages: mockMessages,
        onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          off: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
      };

      command.mockChatClient = {
        rooms: {
          get: vi.fn().mockResolvedValue(mockRoom),
          release: vi.fn().mockImplementation(async () => {}),
        },
        connection: {
          onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
        },
        realtime: command.mockRealtimeClient,
      };

      command.setParseResult({
        flags: { limit: 50, order: "newestFirst", "show-metadata": false },
        args: { room: "test-room" },
        argv: ["test-room"],
        raw: [],
      });
    });

    it("should retrieve room message history", async function () {
      await command.run();

      expect(command.mockChatClient.rooms.get).toBeCalledWith("test-room");
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(historyStub).toHaveBeenCalledOnce();
    });

    it("should handle query options for history", async function () {
      command.setParseResult({
        flags: { limit: 50, order: "oldestFirst" },
        args: { room: "test-room" },
        argv: ["test-room"],
        raw: [],
      });

      await command.run();

      expect(historyStub).toHaveBeenCalledOnce();
      const queryOptions = historyStub.mock.calls[0][0];
      expect(queryOptions).toEqual({ limit: 50, orderBy: "oldestFirst" });
    });
  });
});
