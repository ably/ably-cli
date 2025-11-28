import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import * as Ably from "ably";

import SpacesMembersEnter from "../../../../src/commands/spaces/members/enter.js";
import SpacesMembersSubscribe from "../../../../src/commands/spaces/members/subscribe.js";
import SpacesLocationsSet from "../../../../src/commands/spaces/locations/set.js";
import SpacesLocksAcquire from "../../../../src/commands/spaces/locks/acquire.js";
import SpacesCursorsSet from "../../../../src/commands/spaces/cursors/set.js";

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
    confirm: vi.fn().mockResolvedValue(true),
    promptForText: vi.fn().mockResolvedValue("fake-input"),
    promptToSelect: vi.fn().mockResolvedValue("fake-selection"),
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
  let mockConfig: Config;

  beforeEach(function () {
    mockConfig = { runHook: vi.fn() } as unknown as Config;
  });

  describe("spaces members enter", function () {
    let command: TestableSpacesMembersEnter;
    let mockMembers: any;
    let enterStub: ReturnType<typeof vi.fn>;
    let subscribeStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableSpacesMembersEnter([], mockConfig);

      enterStub = vi.fn().mockImplementation(async () => {});
      subscribeStub = vi.fn();
      mockMembers = {
        enter: enterStub,
        subscribe: subscribeStub,
        unsubscribe: vi.fn().mockImplementation(async () => {}),
      };

      command.mockSpace = {
        enter: enterStub,
        leave: vi.fn().mockImplementation(async () => {}),
        members: mockMembers,
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          state: "connected",
          id: "test-connection-id",
        },
        close: vi.fn(),
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
      subscribeStub.mockImplementation((eventType, callback) => {
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
      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(enterStub).toHaveBeenCalledOnce();
      expect(subscribeStub).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );

      command.mockRealtimeClient.close();
    });

    it("should handle profile data when entering", async function () {
      command.setParseResult({
        flags: { profile: '{"name": "Test User", "role": "admin"}' },
        args: { space: "test-space" },
        argv: [],
        raw: [],
      });

      subscribeStub.mockImplementation(async () => {});

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(enterStub).toHaveBeenCalledOnce();
      const profileData = enterStub.mock.calls[0][0];
      expect(profileData).toEqual({ name: "Test User", role: "admin" });

      command.mockRealtimeClient.close();
    });
  });

  describe("spaces members subscribe", function () {
    let command: TestableSpacesMembersSubscribe;
    let mockMembers: any;
    let subscribeStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableSpacesMembersSubscribe([], mockConfig);

      subscribeStub = vi.fn();
      mockMembers = {
        subscribe: subscribeStub,
        unsubscribe: vi.fn().mockImplementation(async () => {}),
        getAll: vi.fn().mockResolvedValue([
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
        enter: vi.fn().mockImplementation(async () => {}),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          once: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
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
      subscribeStub.mockImplementation((eventName, callback) => {
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

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(subscribeStub).toHaveBeenCalledOnce();

      command.mockRealtimeClient.close();
    });
  });

  describe("spaces locations set", function () {
    let command: TestableSpacesLocationsSet;
    let mockLocations: any;
    let setStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableSpacesLocationsSet([], mockConfig);

      setStub = vi.fn().mockImplementation(async () => {});
      mockLocations = {
        set: setStub,
        subscribe: vi.fn(),
      };

      command.mockSpace = {
        enter: vi.fn().mockImplementation(async () => {}),
        locations: mockLocations,
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          state: "connected",
        },
        auth: {
          clientId: "test-client-id",
        },
        close: vi.fn(),
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

      expect(setStub).toHaveBeenCalledOnce();
      const locationData = setStub.mock.calls[0][0];
      expect(locationData).toEqual({ x: 100, y: 200, page: "dashboard" });
    });
  });

  describe("spaces locks acquire", function () {
    let command: TestableSpacesLocksAcquire;
    let mockLocks: any;
    let acquireStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableSpacesLocksAcquire([], mockConfig);

      acquireStub = vi.fn().mockResolvedValue({
        id: "test-lock",
        member: { clientId: "test-client" },
        timestamp: Date.now(),
      });
      mockLocks = {
        acquire: acquireStub,
      };

      command.mockSpace = {
        enter: vi.fn().mockImplementation(async () => {}),
        locks: mockLocks,
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
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

      expect(acquireStub).toHaveBeenCalledExactlyOnceWith(
        "test-lock",
        expect.toSatisfy((v) => v === undefined),
      );
    });

    it("should handle lock attributes", async function () {
      command.setParseResult({
        flags: {
          data: '{"attributes": {"priority": "high", "timeout": 5000}}',
        },
        args: { space: "test-space", lockId: "test-lock" },
        argv: [],
        raw: [],
      });

      command.run();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(acquireStub).toHaveBeenCalledOnce();
      const lockCallArgs = acquireStub.mock.calls[0];
      expect(lockCallArgs[0]).toBe("test-lock");
      // Attributes would typically be passed as second argument
      expect(lockCallArgs[1]).toBeDefined();
      expect(lockCallArgs[1]).toEqual({
        attributes: {
          priority: "high",
          timeout: 5000,
        },
      });
    });
  });

  describe("spaces cursors set", function () {
    let command: TestableSpacesCursorsSet;
    let mockCursors: any;
    let setStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      command = new TestableSpacesCursorsSet([], mockConfig);

      setStub = vi.fn().mockImplementation(async () => {});
      mockCursors = {
        set: setStub,
      };

      command.mockSpace = {
        cursors: mockCursors,
        enter: vi.fn().mockImplementation(async () => {}),
      };

      command.mockRealtimeClient = {
        connection: {
          on: vi.fn(),
          state: "connected",
        },
        close: vi.fn(),
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

      expect(setStub).toHaveBeenCalledOnce();
      const cursorData = setStub.mock.calls[0][0];
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

      expect(setStub).toHaveBeenCalledOnce();
      const cursorCallArgs = setStub.mock.calls[0];
      expect(cursorCallArgs[0]).toEqual({
        position: { x: 150, y: 250 },
        data: { color: "red", size: "large" },
      });
    });
  });
});
