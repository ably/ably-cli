import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("logs:channel-lifecycle:subscribe command", () => {
  beforeEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
  });

  afterEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
  });

  describe("command flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --rewind flag", async () => {
      // The command might error due to connection, but should accept the flag
      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe", "--rewind", "10"],
        import.meta.url,
      );

      expect(error?.message).not.toMatch(/Unknown flag/);
    });

    it("should accept --json flag", async () => {
      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe", "--json"],
        import.meta.url,
      );

      expect(error?.message).not.toMatch(/Unknown flag/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to channel lifecycle events and show initial message", async () => {
      const mockChannel = {
        name: "[meta]channel.lifecycle",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["logs:channel-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to");
      expect(stdout).toContain("[meta]channel.lifecycle");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should subscribe to channel messages", async () => {
      const mockChannel = {
        name: "[meta]channel.lifecycle",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(["logs:channel-lifecycle:subscribe"], import.meta.url);

      expect(mockChannel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should configure rewind when --rewind is specified", async () => {
      const mockChannel = {
        name: "[meta]channel.lifecycle",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["logs:channel-lifecycle:subscribe", "--rewind", "5"],
        import.meta.url,
      );

      expect(mockChannels.get).toHaveBeenCalledWith("[meta]channel.lifecycle", {
        params: { rewind: "5" },
      });
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["logs:channel-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
