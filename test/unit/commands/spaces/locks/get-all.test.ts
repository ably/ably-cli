import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("spaces:locks:get-all command", () => {
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

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get-all"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should accept --json flag", async () => {
      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      const { error } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);

      globalThis.__TEST_MOCKS__ = undefined;
    });
  });

  describe("lock retrieval", () => {
    afterEach(() => {
      globalThis.__TEST_MOCKS__ = undefined;
    });

    it("should get all locks from a space", async () => {
      const mockLocksData = [
        {
          id: "lock-1",
          member: { clientId: "user-1", connectionId: "conn-1" },
          status: "locked",
        },
      ];

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue(mockLocksData),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockLocks.getAll).toHaveBeenCalled();
      expect(stdout).toContain("test-space");
    });

    it("should handle no locks found", async () => {
      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locks");
    });
  });
});
