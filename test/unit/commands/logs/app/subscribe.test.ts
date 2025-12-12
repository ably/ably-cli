import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("logs:app:subscribe command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockApiKey = `${mockAppId}.testkey:testsecret`;
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.defaults.apps."${mockAppId}"]
apiKey = "${mockApiKey}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
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
    afterEach(() => {
      globalThis.__TEST_MOCKS__ = undefined;
    });

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
    afterEach(() => {
      globalThis.__TEST_MOCKS__ = undefined;
    });

    it("should handle missing mock client in test mode", async () => {
      globalThis.__TEST_MOCKS__ = undefined;

      const { error } = await runCommand(
        ["logs:app:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
