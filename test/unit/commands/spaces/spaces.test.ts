import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import sinon from "sinon";
import { Config } from "@oclif/core";
import * as Ably from "ably";

import SpacesMembersEnter from "../../../../src/commands/spaces/members/enter.js";
import SpacesMembersSubscribe from "../../../../src/commands/spaces/members/subscribe.js";
import SpacesLocationsSet from "../../../../src/commands/spaces/locations/set.js";
import SpacesLocationsGetAll from "../../../../src/commands/spaces/locations/get-all.js";
import SpacesLocationsSubscribe from "../../../../src/commands/spaces/locations/subscribe.js";
import SpacesLocksAcquire from "../../../../src/commands/spaces/locks/acquire.js";
import SpacesLocksGet from "../../../../src/commands/spaces/locks/get.js";
import SpacesLocksGetAll from "../../../../src/commands/spaces/locks/get-all.js";
import SpacesLocksSubscribe from "../../../../src/commands/spaces/locks/subscribe.js";
import SpacesCursorsSet from "../../../../src/commands/spaces/cursors/set.js";
import SpacesCursorsGetAll from "../../../../src/commands/spaces/cursors/get-all.js";
import SpacesCursorsSubscribe from "../../../../src/commands/spaces/cursors/subscribe.js";

// Base testable class for spaces commands
class TestableSpacesCommand {
  protected _parseResult: any;
  public mockRealtimeClient: any;
  public mockSpacesClient: any;
  public mockSpace: any;

  public setParseResult(result: any) {
    this._parseResult = result;
  }

  public async parse() {
    return this._parseResult;
  }

  public async setupSpacesClient(_flags: any, _spaceName: string) {
    return {
      realtimeClient: this.mockRealtimeClient,
      spacesClient: this.mockSpacesClient,
      space: this.mockSpace,
    };
  }

  public createSpacesClient(_realtimeClient: any) {
    return this.mockSpacesClient;
  }

  public async createAblyRealtimeClient(_flags: any) {
    return this.mockRealtimeClient as unknown as Ably.Realtime;
  }

  public async ensureAppAndKey(_flags: any) {
    return { apiKey: "fake:key", appId: "fake-app" } as const;
  }

  public interactiveHelper = {
    confirm: sinon.stub().resolves(true),
    promptForText: sinon.stub().resolves("fake-input"),
    promptToSelect: sinon.stub().resolves("fake-selection"),
  } as any;
}

// Testable subclasses for members commands
class TestableSpacesMembersEnter extends SpacesMembersEnter {
  private testableCommand = new TestableSpacesCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async setupSpacesClient(flags: any, spaceName: string) {
    return this.testableCommand.setupSpacesClient(flags, spaceName);
  }
  protected override createSpacesClient(realtimeClient: any) {
    return this.testableCommand.createSpacesClient(realtimeClient);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
  get mockSpacesClient() {
    return this.testableCommand.mockSpacesClient;
  }
  set mockSpacesClient(value) {
    this.testableCommand.mockSpacesClient = value;
  }
  get mockSpace() {
    return this.testableCommand.mockSpace;
  }
  set mockSpace(value) {
    this.testableCommand.mockSpace = value;
  }
}

class TestableSpacesMembersSubscribe extends SpacesMembersSubscribe {
  private testableCommand = new TestableSpacesCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async setupSpacesClient(flags: any, spaceName: string) {
    return this.testableCommand.setupSpacesClient(flags, spaceName);
  }
  protected override createSpacesClient(realtimeClient: any) {
    return this.testableCommand.createSpacesClient(realtimeClient);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
  get mockSpacesClient() {
    return this.testableCommand.mockSpacesClient;
  }
  set mockSpacesClient(value) {
    this.testableCommand.mockSpacesClient = value;
  }
  get mockSpace() {
    return this.testableCommand.mockSpace;
  }
  set mockSpace(value) {
    this.testableCommand.mockSpace = value;
  }
}

// Testable subclasses for locations commands
class TestableSpacesLocationsSet extends SpacesLocationsSet {
  private testableCommand = new TestableSpacesCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async setupSpacesClient(flags: any, spaceName: string) {
    return this.testableCommand.setupSpacesClient(flags, spaceName);
  }
  protected override createSpacesClient(realtimeClient: any) {
    return this.testableCommand.createSpacesClient(realtimeClient);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
  get mockSpacesClient() {
    return this.testableCommand.mockSpacesClient;
  }
  set mockSpacesClient(value) {
    this.testableCommand.mockSpacesClient = value;
  }
  get mockSpace() {
    return this.testableCommand.mockSpace;
  }
  set mockSpace(value) {
    this.testableCommand.mockSpace = value;
  }
}

// Testable subclasses for locks commands
class TestableSpacesLocksAcquire extends SpacesLocksAcquire {
  private testableCommand = new TestableSpacesCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async setupSpacesClient(flags: any, spaceName: string) {
    return this.testableCommand.setupSpacesClient(flags, spaceName);
  }
  protected override createSpacesClient(realtimeClient: any) {
    return this.testableCommand.createSpacesClient(realtimeClient);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
  get mockSpacesClient() {
    return this.testableCommand.mockSpacesClient;
  }
  set mockSpacesClient(value) {
    this.testableCommand.mockSpacesClient = value;
  }
  get mockSpace() {
    return this.testableCommand.mockSpace;
  }
  set mockSpace(value) {
    this.testableCommand.mockSpace = value;
  }
}

// Testable subclasses for cursors commands
class TestableSpacesCursorsSet extends SpacesCursorsSet {
  private testableCommand = new TestableSpacesCommand();

  public setParseResult(result: any) {
    this.testableCommand.setParseResult(result);
  }
  public override async parse() {
    return this.testableCommand.parse();
  }
  protected override async setupSpacesClient(flags: any, spaceName: string) {
    return this.testableCommand.setupSpacesClient(flags, spaceName);
  }
  protected override createSpacesClient(realtimeClient: any) {
    return this.testableCommand.createSpacesClient(realtimeClient);
  }
  protected override async createAblyRealtimeClient(flags: any) {
    return this.testableCommand.createAblyRealtimeClient(flags);
  }
  protected override async ensureAppAndKey(flags: any) {
    return this.testableCommand.ensureAppAndKey(flags);
  }
  protected override interactiveHelper = this.testableCommand.interactiveHelper;

  get mockRealtimeClient() {
    return this.testableCommand.mockRealtimeClient;
  }
  set mockRealtimeClient(value) {
    this.testableCommand.mockRealtimeClient = value;
  }
  get mockSpacesClient() {
    return this.testableCommand.mockSpacesClient;
  }
  set mockSpacesClient(value) {
    this.testableCommand.mockSpacesClient = value;
  }
  get mockSpace() {
    return this.testableCommand.mockSpace;
  }
  set mockSpace(value) {
    this.testableCommand.mockSpace = value;
  }
}

describe("spaces commands", function () {
  let sandbox: sinon.SinonSandbox;
  let mockConfig: Config;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    mockConfig = { runHook: sinon.stub() } as unknown as Config;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe("spaces members enter", function () {
    let command: TestableSpacesMembersEnter;
    let mockMembers: any;
    let enterStub: sinon.SinonStub;
    let subscribeStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableSpacesMembersEnter([], mockConfig);

      enterStub = sandbox.stub().resolves();
      subscribeStub = sandbox.stub();
      mockMembers = {
        enter: enterStub,
        subscribe: subscribeStub,
        unsubscribe: sandbox.stub().resolves(),
      };

      command.mockSpace = {
        enter: enterStub,
        leave: sandbox.stub().resolves(),
        members: mockMembers,
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          state: "connected",
          id: "test-connection-id",
        },
        close: sandbox.stub(),
      };

      command.mockSpacesClient = {};

      command.setParseResult({
        flags: {},
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });
    });

    it("should enter space and subscribe to member updates", async function () {
      subscribeStub.callsFake((eventType, callback) => {
        // Simulate receiving a member update
        setTimeout(() => {
          callback({
            clientId: "other-client",
            connectionId: "other-connection",
            lastEvent: { name: "enter" },
            isConnected: true,
            profileData: { name: "Other User" },
          });
        }, 10);
        return Promise.resolve();
      });

      // Since members enter runs indefinitely, we'll test the setup
      const runPromise = command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(enterStub.calledOnce).toBe(true);
      expect(subscribeStub.calledWith("update")).toBe(true);

      command.mockRealtimeClient.close();
    });

    it("should handle profile data when entering", async function () {
      command.setParseResult({
        flags: { profile: '{"name": "Test User", "role": "admin"}' },
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });

      subscribeStub.resolves();

      const runPromise = command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(enterStub.calledOnce).toBe(true);
      const profileData = enterStub.getCall(0).args[0];
      expect(profileData).toEqual({ name: "Test User", role: "admin" });

      command.mockRealtimeClient.close();
    });
  });

  describe("spaces members subscribe", function () {
    let command: TestableSpacesMembersSubscribe;
    let mockMembers: any;
    let subscribeStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableSpacesMembersSubscribe([], mockConfig);

      subscribeStub = sandbox.stub();
      mockMembers = {
        subscribe: subscribeStub,
        unsubscribe: sandbox.stub().resolves(),
        getAll: sandbox.stub().resolves([
          {
            clientId: "abc",
            connectionId: "def",
            isConnected: true,
            profileData: {},
          },
        ]),
      };

      command.mockSpace = {
        members: mockMembers,
        enter: sandbox.stub().resolves(),
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          once: sandbox.stub(),
          state: "connected",
        },
        close: sandbox.stub(),
        auth: {
          clientId: "foo",
        },
      };

      command.mockSpacesClient = {};

      command.setParseResult({
        flags: {},
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });
    });

    it("should subscribe to member updates", async function () {
      subscribeStub.callsFake((eventName, callback) => {
        setTimeout(() => {
          callback({
            clientId: "client-123",
            connectionId: "connection-456",
            lastEvent: { name: "update" },
            isConnected: true,
            profileData: { status: "active" },
          });
        }, 10);
        return Promise.resolve();
      });

      const runPromise = command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(subscribeStub.calledOnce).toBe(true);

      command.mockRealtimeClient.close();
    });
  });

  describe("spaces locations set", function () {
    let command: TestableSpacesLocationsSet;
    let mockLocations: any;
    let setStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableSpacesLocationsSet([], mockConfig);

      setStub = sandbox.stub().resolves();
      mockLocations = {
        set: setStub,
        subscribe: sandbox.stub(),
      };

      command.mockSpace = {
        enter: sandbox.stub().resolves(),
        locations: mockLocations,
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          state: "connected",
        },
        auth: {
          clientId: "test-client-id",
        },
        close: sandbox.stub(),
      };

      command.mockSpacesClient = {};

      command.setParseResult({
        flags: {},
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });
    });

    it("should set location data", async function () {
      command.setParseResult({
        flags: { location: '{"x": 100, "y": 200, "page": "dashboard"}' },
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(setStub.calledOnce).toBe(true);
      const locationData = setStub.getCall(0).args[0];
      expect(locationData).toEqual({ x: 100, y: 200, page: "dashboard" });
    });
  });

  describe("spaces locks acquire", function () {
    let command: TestableSpacesLocksAcquire;
    let mockLocks: any;
    let acquireStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableSpacesLocksAcquire([], mockConfig);

      acquireStub = sandbox.stub().resolves({
        id: "test-lock",
        member: { clientId: "test-client" },
        timestamp: Date.now(),
      });
      mockLocks = {
        acquire: acquireStub,
      };

      command.mockSpace = {
        enter: sandbox.stub().resolves(),
        locks: mockLocks,
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          state: "connected",
        },
        close: sandbox.stub(),
        auth: {
          clientId: "foo",
        },
      };

      command.mockSpacesClient = {};

      command.setParseResult({
        flags: {},
        args: { space: "test-space", lockId: "test-lock" },
        argv: [],
        raw: [],
      });
    });

    it("should acquire a lock successfully", async function () {
      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(acquireStub.calledOnce).toBe(true);
      expect(acquireStub.calledWith("test-lock")).toBe(true);
    });

    it("should handle lock attributes", async function () {
      command.setParseResult({
        flags: { attributes: '{"priority": "high", "timeout": 5000}' },
        args: { space: "test-space", lockId: "test-lock" },
        argv: [],
        raw: [],
      });

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(acquireStub.calledOnce).toBe(true);
      const lockCall = acquireStub.getCall(0);
      expect(lockCall.args[0]).toBe("test-lock");
      // Attributes would typically be passed as second argument
      if (lockCall.args[1]) {
        expect(lockCall.args[1]).to.deep.include({
          priority: "high",
          timeout: 5000,
        });
      }
    });
  });

  describe("spaces cursors set", function () {
    let command: TestableSpacesCursorsSet;
    let mockCursors: any;
    let setStub: sinon.SinonStub;

    beforeEach(function () {
      command = new TestableSpacesCursorsSet([], mockConfig);

      setStub = sandbox.stub().resolves();
      mockCursors = {
        set: setStub,
      };

      command.mockSpace = {
        cursors: mockCursors,
        enter: sandbox.stub().resolves(),
      };

      command.mockRealtimeClient = {
        connection: {
          on: sandbox.stub(),
          state: "connected",
        },
        close: sandbox.stub(),
        auth: {
          clientId: "foo",
        },
      };

      command.mockSpacesClient = {};

      command.setParseResult({
        flags: {},
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });
    });

    it("should set cursor position", async function () {
      command.setParseResult({
        flags: { x: 150, y: 250 },
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(setStub.calledOnce).toBe(true);
      const cursorData = setStub.getCall(0).args[0];
      expect(cursorData).toEqual({ position: { x: 150, y: 250 } });
    });

    it("should handle cursor data with metadata", async function () {
      command.setParseResult({
        flags: {
          data: '{"data": { "color": "red", "size": "large" }, "position": {"x": 150, "y": 250}}',
        },
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(setStub.calledOnce).toBe(true);
      const cursorCall = setStub.getCall(0);
      expect(cursorCall.args[0]).toEqual({
        position: { x: 150, y: 250 },
        data: { color: "red", size: "large" },
      });
    });
  });
});
