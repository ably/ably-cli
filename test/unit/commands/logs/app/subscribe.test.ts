import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("logs:app:subscribe command", () => {
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
        ["logs:app:subscribe", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --rewind flag", async () => {
      // Run with --duration 0 to exit immediately
      const { error } = await runCommand(
        ["logs:app:subscribe", "--rewind", "10", "--duration", "0"],
        import.meta.url,
      );

      // The command might error due to connection issues, but it should accept the flag
      expect(error?.message).not.toMatch(/Unknown flag/);
    });

    it("should accept --type flag with valid option", async () => {
      const { error } = await runCommand(
        [
          "logs:app:subscribe",
          "--type",
          "channel.lifecycle",
          "--duration",
          "0",
        ],
        import.meta.url,
      );

      expect(error?.message).not.toMatch(/Unknown flag/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to log channel and show initial message", async () => {
      const mockChannel = {
        name: "[meta]log",
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
        ["logs:app:subscribe"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to app logs");
      expect(stdout).toContain("Press Ctrl+C to exit");
    });

    it("should subscribe to specific log types", async () => {
      const mockChannel = {
        name: "[meta]log",
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
        ["logs:app:subscribe", "--type", "channel.lifecycle"],
        import.meta.url,
      );

      // Verify subscribe was called with the specific type
      expect(mockChannel.subscribe).toHaveBeenCalledWith(
        "channel.lifecycle",
        expect.any(Function),
      );
    });

    it("should configure rewind when --rewind is specified", async () => {
      const mockChannel = {
        name: "[meta]log",
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
        ["logs:app:subscribe", "--rewind", "10"],
        import.meta.url,
      );

      // Verify channel was gotten with rewind params
      expect(mockChannels.get).toHaveBeenCalledWith("[meta]log", {
        params: { rewind: "10" },
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
        ["logs:app:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
