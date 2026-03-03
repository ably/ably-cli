import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("spaces commands", () => {
  beforeEach(() => {
    // Configure the realtime mock
    const realtimeMock = getMockAblyRealtime();
    realtimeMock.auth.clientId = "test-client-id";
    realtimeMock.connection.id = "conn-123";

    // Configure the spaces mock with test data
    const spacesMock = getMockAblySpaces();
    const space = spacesMock._getSpace("test-space");

    // Configure members
    space.members.getSelf.mockResolvedValue({
      clientId: "test-client-id",
      connectionId: "conn-123",
      isConnected: true,
      profileData: {},
    });

    // Configure locks to return a lock object
    space.locks.acquire.mockResolvedValue({ id: "lock-1" });
  });

  describe("spaces topic", () => {
    it("should list available spaces subcommands when run without arguments", async () => {
      const { stdout } = await runCommand(["spaces"], import.meta.url);

      expect(stdout).toContain("Spaces commands");
      expect(stdout).toContain("members");
      expect(stdout).toContain("locations");
      expect(stdout).toContain("locks");
      expect(stdout).toContain("cursors");
    });

    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Interact with Ably Spaces");
      expect(stdout).toContain("USAGE");
    });
  });

  describe("spaces members enter", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Enter a space");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should enter a space successfully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:members:enter", "test-space", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("test-space");
      expect(space.enter).toHaveBeenCalled();
    });

    it("should enter a space with profile data", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        [
          "spaces:members:enter",
          "test-space",
          "--api-key",
          "app.key:secret",
          "--profile",
          '{"name":"TestUser","status":"online"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("test-space");
      expect(space.enter).toHaveBeenCalledWith({
        name: "TestUser",
        status: "online",
      });
    });
  });

  describe("spaces members subscribe", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribe to member");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should subscribe and display member events with action and client info", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      // Capture the member callback to simulate events
      let memberCallback: ((member: unknown) => void) | null = null;
      space.members.subscribe.mockImplementation(
        (_event: string, callback: (member: unknown) => void) => {
          memberCallback = callback;
          return Promise.resolve();
        },
      );

      const commandPromise = runCommand(
        [
          "spaces:members:subscribe",
          "test-space",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Wait for subscription to be set up
      await vi.waitFor(() => {
        expect(memberCallback).not.toBeNull();
      });

      // Simulate a member entering - use a different connectionId than the mock's
      memberCallback!({
        clientId: "new-user",
        connectionId: "other-conn-456",
        isConnected: true,
        profileData: { name: "New User" },
        lastEvent: { name: "enter" },
      });

      const { stdout } = await commandPromise;

      // Should display member event with client info and action
      expect(stdout).toContain("new-user");
      expect(stdout).toContain("enter");
    });
  });

  describe("spaces locations set", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:locations:set", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Set your location");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should set location with --location flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        [
          "spaces:locations:set",
          "test-space",
          "--api-key",
          "app.key:secret",
          "--location",
          '{"x":100,"y":200}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Successfully set location");
      expect(space.locations.set).toHaveBeenCalledWith({ x: 100, y: 200 });
    });
  });

  describe("spaces locks acquire", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:locks:acquire", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Acquire a lock");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
      expect(stdout).toContain("LOCKID");
    });

    it("should acquire lock with --data flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        [
          "spaces:locks:acquire",
          "test-space",
          "my-lock",
          "--api-key",
          "app.key:secret",
          "--data",
          '{"reason":"editing"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Successfully acquired lock");
      expect(space.locks.acquire).toHaveBeenCalledWith("my-lock", {
        reason: "editing",
      });
    });
  });

  describe("spaces cursors set", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:cursors:set", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("cursor");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should set cursor with x and y flags", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        [
          "spaces:cursors:set",
          "test-space",
          "--api-key",
          "app.key:secret",
          "--x",
          "50",
          "--y",
          "75",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Set cursor");
      expect(space.cursors.set).toHaveBeenCalledWith({
        position: { x: 50, y: 75 },
      });
    });
  });
});
