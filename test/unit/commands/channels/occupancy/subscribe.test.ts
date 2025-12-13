import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("channels:occupancy:subscribe command", () => {
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

[accounts.default.apps."${mockAppId}"]
appName = "Test App"
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

    globalThis.__TEST_MOCKS__ = undefined;
  });

  describe("command arguments and flags", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to occupancy events and show initial message", async () => {
      const mockChannel = {
        name: "test-channel",
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

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      const { stdout } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to occupancy events on channel");
      expect(stdout).toContain("test-channel");
      expect(mockChannels.get).toHaveBeenCalledWith("test-channel", {
        params: { occupancy: "metrics" },
      });
    });

    it("should get channel with occupancy params enabled", async () => {
      const mockChannel = {
        name: "test-channel",
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

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      // Verify channel was gotten with occupancy params
      expect(mockChannels.get).toHaveBeenCalledWith("test-channel", {
        params: {
          occupancy: "metrics",
        },
      });
    });

    it("should subscribe to [meta]occupancy event", async () => {
      const mockChannel = {
        name: "test-channel",
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

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      // Verify subscribe was called with the correct event name
      expect(mockChannel.subscribe).toHaveBeenCalledWith(
        "[meta]occupancy",
        expect.any(Function),
      );
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mockChannel = {
        name: "test-channel",
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
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle missing mock client in test mode", async () => {
      // No mock set up
      globalThis.__TEST_MOCKS__ = undefined;

      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });

  describe("output formats", () => {
    it("should accept --json flag", async () => {
      const mockChannel = {
        name: "test-channel",
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

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      // Should not throw for --json flag
      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      // No flag-related error should occur
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
