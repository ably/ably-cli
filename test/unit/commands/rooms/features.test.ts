import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import * as Ably from "ably";

import RoomsOccupancyGet from "../../../../src/commands/rooms/occupancy/get.js";
import RoomsOccupancySubscribe from "../../../../src/commands/rooms/occupancy/subscribe.js";
import RoomsPresenceEnter from "../../../../src/commands/rooms/presence/enter.js";
import RoomsReactionsSend from "../../../../src/commands/rooms/reactions/send.js";
import RoomsTypingKeystroke from "../../../../src/commands/rooms/typing/keystroke.js";
import { RoomStatus } from "@ably/chat";

// Base testable class for room feature commands
class TestableRoomCommand {
  protected _parseResult: any;
  public mockChatClient: any;
  public mockRealtimeClient: any;

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  public async parse() {
    return this._parseResult;
  }

  public async createChatClient(_flags: any) {
    // Mimic the behavior of ChatBaseCommand.createChatClient
    // which sets _chatRealtimeClient
    (this as any)._chatRealtimeClient = this.mockRealtimeClient;
    return this.mockChatClient;
  }

  public async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  public async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  public interactiveHelper = {
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
  } as any;
}

// Testable subclasses
class TestableRoomsOccupancyGet extends RoomsOccupancyGet {
  private testableCommand = new TestableRoomCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async createChatClient(flags: any) {
    return this.testableCommand.createChatClient(flags);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockChatClient() {
    return this.testableCommand.mockChatClient;
  }
  set mockChatClient(value) {
    this.testableCommand.mockChatClient = value;
  }
  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
}

class TestableRoomsOccupancySubscribe extends RoomsOccupancySubscribe {
  private testableCommand = new TestableRoomCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async createChatClient(flags: any) {
    const client = this.testableCommand.createChatClient(flags);
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.testableCommand.mockRealtimeClient;
    return client;
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockChatClient() {
    return this.testableCommand.mockChatClient;
  }
  set mockChatClient(value) {
    this.testableCommand.mockChatClient = value;
  }
  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
}

class TestableRoomsPresenceEnter extends RoomsPresenceEnter {
  private testableCommand = new TestableRoomCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async createChatClient(flags: any) {
    const client = this.testableCommand.createChatClient(flags);
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.testableCommand.mockRealtimeClient;
    return client;
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockChatClient() {
    return this.testableCommand.mockChatClient;
  }
  set mockChatClient(value) {
    this.testableCommand.mockChatClient = value;
  }
  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
}

class TestableRoomsReactionsSend extends RoomsReactionsSend {
  private testableCommand = new TestableRoomCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async createChatClient(flags: any) {
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.testableCommand.mockRealtimeClient;

    return this.testableCommand.createChatClient(flags);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockChatClient() {
    return this.testableCommand.mockChatClient;
  }
  set mockChatClient(value) {
    this.testableCommand.mockChatClient = value;
  }
  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
}

class TestableRoomsTypingKeystroke extends RoomsTypingKeystroke {
  private testableCommand = new TestableRoomCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async createChatClient(flags: any) {
    // Set _chatRealtimeClient as the parent class expects
    (this as any)._chatRealtimeClient = this.testableCommand.mockRealtimeClient;

    return this.testableCommand.createChatClient(flags);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockChatClient() {
    return this.testableCommand.mockChatClient;
  }
  set mockChatClient(value) {
    this.testableCommand.mockChatClient = value;
  }
  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
}

describe("rooms feature commands", function () {
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
  });

  describe("rooms occupancy get", function () {
    let command: TestableRoomsOccupancyGet;
    let mockRoom: any;
    let mockOccupancy: any;
    let getStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsOccupancyGet([], mockConfig);

      getStub = vi.fn().mockResolvedValue({
        connections: 5,
        publishers: 2,
        subscribers: 3,
        presenceConnections: 2,
        presenceMembers: 4,
      });

      mockOccupancy = {
        get: getStub,
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        occupancy: mockOccupancy,
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
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

    it("should get room occupancy metrics", async function () {
      await command.run();

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(getStub).toHaveBeenCalledOnce();
    });
  });

  describe("rooms occupancy subscribe", function () {
    let command: TestableRoomsOccupancySubscribe;
    let mockRoom: any;
    let mockOccupancy: any;
    let subscribeStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsOccupancySubscribe([], mockConfig);

      subscribeStub = vi.fn();
      mockOccupancy = {
        subscribe: subscribeStub,
        unsubscribe: vi.fn().mockImplementation(async () => {}),
        get: vi.fn().mockResolvedValue({ connections: 0, presenceMembers: 0 }),
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        occupancy: mockOccupancy,
        onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
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

    it("should subscribe to room occupancy updates", async function () {
      subscribeStub.mockImplementation((callback) => {
        setTimeout(() => {
          callback({
            connections: 6,
            publishers: 3,
            subscribers: 3,
            presenceConnections: 2,
            presenceMembers: 4,
          });
        }, 10);
        return Promise.resolve();
      });

      // Since subscribe runs indefinitely, we'll test the setup
      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
        {
          occupancy: {
            enableEvents: true,
          },
        },
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(subscribeStub).toHaveBeenCalledOnce();

      command.mockRealtimeClient.close();
    });
  });

  describe("rooms presence enter", function () {
    let command: TestableRoomsPresenceEnter;
    let mockRoom: any;
    let mockPresence: any;
    let enterStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsPresenceEnter([], mockConfig);

      enterStub = vi.fn().mockImplementation(async () => {});
      mockPresence = {
        enter: enterStub,
        subscribe: vi.fn(),
        unsubscribe: vi.fn().mockImplementation(async () => {}),
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        presence: mockPresence,
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          state: "connected",
          id: "test-connection-id",
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

    it("should enter room presence successfully", async function () {
      // Since presence enter runs indefinitely, we'll test the setup
      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(enterStub).toHaveBeenCalledOnce();

      command.mockRealtimeClient.close();
    });

    it("should handle presence data", async function () {
      command.setParseResult({
        flags: { data: '{"status": "online", "name": "Test User"}' },
        args: { room: "test-room" },
        argv: [],
        raw: [],
      });

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(enterStub).toHaveBeenCalledOnce();
      const presenceData = enterStub.mock.calls[0][0];
      expect(presenceData).toEqual({
        status: "online",
        name: "Test User",
      });

      command.mockRealtimeClient.close();
    });
  });

  describe("rooms reactions send", function () {
    let command: TestableRoomsReactionsSend;
    let mockRoom: any;
    let mockReactions: any;
    let sendStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsReactionsSend([], mockConfig);

      sendStub = vi.fn().mockImplementation(async () => {});
      mockReactions = {
        send: sendStub,
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        reactions: mockReactions,
        onStatusChange: vi.fn().mockReturnValue({ off: vi.fn() }),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
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
        args: { room: "test-room", emoji: "👍" },
        argv: [],
        raw: [],
      });
    });

    it("should send a reaction successfully", async function () {
      await command.run();

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(sendStub).toHaveBeenCalledOnce();
      expect(sendStub).toHaveBeenCalledWith({ name: "👍", metadata: {} });
    });

    it("should handle metadata in reactions", async function () {
      command.setParseResult({
        flags: { metadata: '{"intensity": "high"}' },
        args: { room: "test-room", emoji: "🎉" },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(sendStub).toHaveBeenCalledOnce();
      const reactionCallArgs = sendStub.mock.calls[0];
      expect(reactionCallArgs[0]).toEqual({
        name: "🎉",
        metadata: { intensity: "high" },
      });
    });
  });

  describe("rooms typing keystroke", function () {
    let command: TestableRoomsTypingKeystroke;
    let mockRoom: any;
    let mockTyping: any;
    let keystrokeStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableRoomsTypingKeystroke([], mockConfig);

      keystrokeStub = vi.fn().mockImplementation(async () => {});
      mockTyping = {
        keystroke: keystrokeStub,
      };

      mockRoom = {
        attach: vi.fn().mockImplementation(async () => {}),
        typing: mockTyping,
        onStatusChange: vi.fn().mockImplementation((listener) => {
          listener({ current: RoomStatus.Attached });
          return { off: vi.fn() };
        }),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
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

    it("should start typing indicator", async function () {
      command.run();

      // Wait for setup to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(command.mockChatClient.rooms.get).toHaveBeenCalledWith(
        "test-room",
      );
      expect(mockRoom.attach).toHaveBeenCalledOnce();
      expect(keystrokeStub).toHaveBeenCalledOnce();

      // Clean up
      command.mockRealtimeClient.close();
    });
  });
});
