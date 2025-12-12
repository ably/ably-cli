import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("apps:logs:subscribe command", () => {
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

[apps."${mockAppId}"]
apiKey = "${mockApiKey}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    delete process.env.ABLY_ACCESS_TOKEN;
    globalThis.__TEST_MOCKS__ = undefined;

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
        ["apps:logs:subscribe", "--unknown-flag-xyz"],
        import.meta.url,
      );

      // Unknown flag should cause an error
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("alias behavior", () => {
    it("should delegate to logs:app:subscribe with --rewind flag", async () => {
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
        ["apps:logs:subscribe", "--rewind", "5"],
        import.meta.url,
      );

      // Should delegate to logs:app:subscribe and show subscription message
      expect(stdout).toContain("Subscribing to app logs");
      // Verify rewind was passed through
      expect(mockChannels.get).toHaveBeenCalledWith("[meta]log", {
        params: { rewind: "5" },
      });
    });

    it("should accept --json flag", async () => {
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

      const { error } = await runCommand(
        ["apps:logs:subscribe", "--json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
