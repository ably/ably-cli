import { expect } from "chai";
import sinon from "sinon";
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
    return this.mockChatClient;
  }

  protected override async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  protected override async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  protected override interactiveHelper = {
    confirm: sinon.stub().resolves(true),
    promptForText: sinon.stub().resolves("fake-input"),
    promptToSelect: sinon.stub().resolves("fake-selection"),
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
    confirm: sinon.stub().resolves(true),
    promptForText: sinon.stub().resolves("fake-input"),
    promptToSelect: sinon.stub().resolves("fake-selection"),
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
    return this.mockChatClient;
  }

  protected override async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  protected override async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  protected override interactiveHelper = {
    confirm: sinon.stub().resolves(true),
    promptForText: sinon.stub().resolves("fake-input"),
    promptToSelect: sinon.stub().resolves("fake-selection"),
  } as any;
}

describe("rooms messages commands", function () {
  let sandbox: sinon.SinonSandbox;
  let mockConfig: Config;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    mockConfig = { runHook: sinon.stub() } as unknown as Config;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("rooms messages send", function () {
    let command: TestableRoomsMessagesSend;
    let mockRoom: any;
    let mockMessages: any;
    let sendStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableRoomsMessagesSend([], mockConfig);

      sendStub = sandbox.stub().resolves();
      mockMessages = {
        send: sendStub,
      };

      mockRoom = {
        attach: sandbox.stub().resolves(),
        messages: mockMessages,
        onStatusChange: sandbox.stub().returns({ off: sandbox.stub() }),
      };

      command.mockChatClient = {
        rooms: {
          get: sandbox.stub().resolves(mockRoom),
          release: sandbox.stub().resolves(),
        },
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          once: sandbox.stub(),
          off: sandbox.stub(),
          state: "connected",
        },
        close: sandbox.stub(),
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

      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.getCall(0).args[0]).to.deep.include({
        text: "Hello World",
      });
      expect(command.mockChatClient.rooms.get.calledWith("test-room")).to.be.true;
      expect(mockRoom.attach.calledOnce).to.be.true;
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
      expect(sendStub.callCount).to.equal(3);

      // Check first and last calls for interpolation
      const firstCall = sendStub.getCall(0);
      const lastCall = sendStub.getCall(2);

      expect(firstCall.args[0].text).to.equal("Message 1");
      expect(lastCall.args[0].text).to.equal("Message 3");
    });

    it("should handle metadata in messages", async function () {
      command.setParseResult({
        flags: { metadata: '{"isImportant": true}' },
        args: { room: "test-room", text: "Important message" },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.getCall(0).args[0]).to.deep.include({
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

      try {
        await command.run();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.include("Invalid metadata JSON");
      }
    });
  });

  describe("rooms messages subscribe", function () {
    let command: TestableRoomsMessagesSubscribe;
    let mockRoom: any;
    let mockMessages: any;
    let subscribeStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableRoomsMessagesSubscribe([], mockConfig);

      subscribeStub = sandbox.stub();
      mockMessages = {
        subscribe: subscribeStub,
        unsubscribe: sandbox.stub().resolves(),
      };

      mockRoom = {
        attach: sandbox.stub().resolves(),
        messages: mockMessages,
        onStatusChange: sandbox.stub().returns({ off: sandbox.stub() }),
      };

      command.mockChatClient = {
        rooms: {
          get: sandbox.stub().resolves(mockRoom),
          release: sandbox.stub().resolves(),
        },
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          once: sandbox.stub(),
          off: sandbox.stub(),
          state: "connected",
        },
        close: sandbox.stub(),
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
      subscribeStub.callsFake((callback) => {
        // Simulate receiving a message
        setTimeout(() => {
          callback({
            message: {
              text: "Test message",
              clientId: "test-client",
              timestamp: new Date(),
            }
          });
        }, 10);
        return Promise.resolve();
      });

      // Since subscribe runs indefinitely, we'll test the setup
      const runPromise = command.run();

      // Give it a moment to set up
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(command.mockChatClient.rooms.get.calledWith("test-room")).to.be.true;
      expect(mockRoom.attach.calledOnce).to.be.true;
      expect(subscribeStub.calledOnce).to.be.true;

      // Cleanup - this would normally be done by SIGINT
      command.mockRealtimeClient.close();
    });
  });

  describe("rooms messages history", function () {
    let command: TestableRoomsMessagesHistory;
    let mockRoom: any;
    let mockMessages: any;
    let getStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableRoomsMessagesHistory([], mockConfig);

      getStub = sandbox.stub().resolves({
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
        get: getStub,
      };

      mockRoom = {
        attach: sandbox.stub().resolves(),
        messages: mockMessages,
        onStatusChange: sandbox.stub().returns({ off: sandbox.stub() }),
      };

      command.mockChatClient = {
        rooms: {
          get: sandbox.stub().resolves(mockRoom),
          release: sandbox.stub().resolves(),
        },
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          once: sandbox.stub(),
          off: sandbox.stub(),
          state: "connected",
        },
        close: sandbox.stub(),
      };

      command.setParseResult({
        flags: {},
        args: { room: "test-room" },
        argv: [],
        raw: [],
      });
    });

    it("should retrieve room message history", async function () {
      await command.run();

      expect(command.mockChatClient.rooms.get.calledWith("test-room")).to.be.true;
      expect(mockRoom.attach.calledOnce).to.be.true;
      expect(getStub.calledOnce).to.be.true;
    });

    it("should handle query options for history", async function () {
      command.setParseResult({
        flags: { limit: 50, direction: "forwards" },
        args: { room: "test-room" },
        argv: [],
        raw: [],
      });

      await command.run();

      expect(getStub.calledOnce).to.be.true;
      const queryOptions = getStub.getCall(0).args[0];
      expect(queryOptions).to.include({ limit: 50, direction: "forwards" });
    });
  });
});
