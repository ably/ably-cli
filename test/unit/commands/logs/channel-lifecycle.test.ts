import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("logs:channel-lifecycle command", () => {
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
        ["logs:channel-lifecycle", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to [meta]channel.lifecycle and show initial message", async () => {
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

      // Emit SIGINT after a short delay to exit the command
      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["logs:channel-lifecycle"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to");
      expect(stdout).toContain("[meta]channel.lifecycle");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should get channel without rewind params when --rewind is not specified", async () => {
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

      await runCommand(["logs:channel-lifecycle"], import.meta.url);

      // Verify channel was gotten with empty options (no rewind)
      expect(mockChannels.get).toHaveBeenCalledWith(
        "[meta]channel.lifecycle",
        {},
      );
    });

    it("should configure rewind channel option when --rewind is specified", async () => {
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
        ["logs:channel-lifecycle", "--rewind", "5"],
        import.meta.url,
      );

      // Verify channel was gotten with rewind params
      expect(mockChannels.get).toHaveBeenCalledWith("[meta]channel.lifecycle", {
        params: {
          rewind: "5",
        },
      });
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

      await runCommand(["logs:channel-lifecycle"], import.meta.url);

      // Verify subscribe was called with a callback function
      expect(mockChannel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mockChannel = {
        name: "[meta]channel.lifecycle",
        subscribe: vi.fn().mockImplementation(() => {
          throw new Error("Subscription failed");
        }),
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

      const { error } = await runCommand(
        ["logs:channel-lifecycle"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["logs:channel-lifecycle"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });

  describe("cleanup behavior", () => {
    it("should call client.close on cleanup", async () => {
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

      const mockClose = vi.fn();

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: mockClose,
        },
      };

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(["logs:channel-lifecycle"], import.meta.url);

      // Verify close was called during cleanup
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("output formats", () => {
    it("should accept --json flag", async () => {
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

      const { error } = await runCommand(
        ["logs:channel-lifecycle", "--json"],
        import.meta.url,
      );

      // No flag-related error should occur
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
