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
        args: { room: "test-room" },
        argv: [],
        raw: [],
      });
    });

    it("should subscribe to room messages", async function () {
      // Mock the subscription to resolve immediately
      subscribeStub.mockImplementation((callback) => {
        // Simulate receiving a message
        setTimeout(() => {
          callback({
            message: {
              text: "Test message",
              clientId: "test-client",
              timestamp: new Date(),
            },
          });
        }, 10);
        return Promise.resolve();
      });

      // Since subscribe runs indefinitely, we'll test the setup
      command.run();

      // Give it a moment to set up
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(subscribeStub).toHaveBeenCalledOnce();

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
        flags: { limit: 20 },
        args: { room: "test-room" },
        argv: [],
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
        flags: { limit: 50 },
        args: { room: "test-room" },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(historyStub).toHaveBeenCalledOnce();
      const queryOptions = historyStub.mock.calls[0][0];
      expect(queryOptions).toEqual({ limit: 50 });
    });
  });
});
