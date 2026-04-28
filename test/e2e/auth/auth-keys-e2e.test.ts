import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  E2E_ACCESS_TOKEN,
  SHOULD_SKIP_CONTROL_E2E,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { createTestApp } from "../../helpers/e2e-test-app.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_CONTROL_E2E)("Auth Keys E2E Tests", () => {
  let testAppId: string;
  let teardownApp: (() => Promise<void>) | undefined;
  // Temp config directory for switch/current tests that need a local account
  let tempConfigDir: string;

  beforeAll(async () => {
    ({ appId: testAppId, teardown: teardownApp } =
      await createTestApp("e2e-keys-test"));

    // Create a temp config dir with a test account so switch/current commands
    // can use configManager.storeAppKey / getApiKey (requires a local account).
    // Uses ABLY_CLI_CONFIG_DIR env var to point the CLI at this config.
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "ably-e2e-keys-"));
    const tomlConfig = `[current]
account = "e2e-test"

[accounts.e2e-test]
accessToken = "${E2E_ACCESS_TOKEN || ""}"
accountId = "e2e-test-account"
accountName = "E2E Test Account"
userEmail = "e2e@test.com"
currentAppId = "${testAppId || ""}"
`;
    fs.writeFileSync(path.join(tempConfigDir, "config"), tomlConfig, {
      mode: 0o600,
    });
  });

  afterAll(async () => {
    await teardownApp?.();
    // Clean up temp config directory
    if (tempConfigDir) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  it("should list API keys for an app", { timeout: 15000 }, async () => {
    setupTestFailureHandler("should list API keys for an app");

    const listResult = await runCommand(
      ["auth", "keys", "list", "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    expect(listResult.exitCode).toBe(0);
    const records = parseNdjsonLines(listResult.stdout);
    const result = records.find((r) => r.type === "result");
    expect(result).toBeDefined();
    expect(result).toHaveProperty("success", true);
    expect(Array.isArray(result!.keys)).toBe(true);
    // Every app has at least one default key
    expect((result!.keys as unknown[]).length).toBeGreaterThan(0);
  });

  it("should create a new API key", { timeout: 15000 }, async () => {
    setupTestFailureHandler("should create a new API key");

    const keyName = `e2e-test-key-${Date.now()}`;
    const createResult = await runCommand(
      ["auth", "keys", "create", keyName, "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    expect(createResult.exitCode).toBe(0);
    const result = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result).toHaveProperty("success", true);
    const key = result.key as Record<string, unknown>;
    expect(key).toHaveProperty("name", keyName);
    expect(key).toHaveProperty("key");
    expect(key).toHaveProperty("keyName");
  });

  it("should get details for a specific key", { timeout: 20000 }, async () => {
    setupTestFailureHandler("should get details for a specific key");

    // First create a key to get
    const keyName = `e2e-get-key-${Date.now()}`;
    const createResult = await runCommand(
      ["auth", "keys", "create", keyName, "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    const createRecord = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    const createdKey = createRecord.key as Record<string, unknown>;
    const keyFullName = createdKey.keyName as string;

    // Now get that key by its name (appId is embedded in keyFullName)
    const getResult = await runCommand(
      ["auth", "keys", "get", keyFullName, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    expect(getResult.exitCode).toBe(0);
    const getRecord = parseNdjsonLines(getResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    expect(getRecord).toBeDefined();
    expect(getRecord).toHaveProperty("success", true);
    const fetchedKey = getRecord.key as Record<string, unknown>;
    expect(fetchedKey).toHaveProperty("name", keyName);
    expect(fetchedKey).toHaveProperty("keyName", keyFullName);
  });

  it("should update a key name", { timeout: 20000 }, async () => {
    setupTestFailureHandler("should update a key name");

    // First create a key to update
    const originalName = `e2e-update-key-${Date.now()}`;
    const createResult = await runCommand(
      ["auth", "keys", "create", originalName, "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    const createRecord = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    const createdKey = createRecord.key as Record<string, unknown>;
    const keyFullName = createdKey.keyName as string;

    // Update the key name
    const updatedName = `updated-key-${Date.now()}`;
    // appId is embedded in keyFullName, no --app needed
    const updateResult = await runCommand(
      ["auth", "keys", "update", keyFullName, "--name", updatedName, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    expect(updateResult.exitCode).toBe(0);
    const updateRecord = parseNdjsonLines(updateResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    expect(updateRecord).toBeDefined();
    expect(updateRecord).toHaveProperty("success", true);
    const updatedKey = updateRecord.key as Record<string, unknown>;
    const nameChange = updatedKey.name as Record<string, unknown>;
    expect(nameChange).toHaveProperty("before", originalName);
    expect(nameChange).toHaveProperty("after", updatedName);
  });

  it("should revoke a key by key name", { timeout: 20000 }, async () => {
    setupTestFailureHandler("should revoke a key by key name");

    // First create a key to revoke
    const keyName = `e2e-revoke-key-${Date.now()}`;
    const createResult = await runCommand(
      ["auth", "keys", "create", keyName, "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    const createRecord = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    const createdKey = createRecord.key as Record<string, unknown>;
    const keyFullName = createdKey.keyName as string;

    // Revoke by key name (appId is embedded in keyFullName), --force to skip confirmation
    const revokeResult = await runCommand(
      ["auth", "keys", "revoke", keyFullName, "--force", "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    expect(revokeResult.exitCode).toBe(0);
    const revokeRecord = parseNdjsonLines(revokeResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    expect(revokeRecord).toBeDefined();
    expect(revokeRecord).toHaveProperty("success", true);
    const revokedKey = revokeRecord.key as Record<string, unknown>;
    expect(revokedKey).toHaveProperty("keyName", keyFullName);
    expect(revokedKey).toHaveProperty("message", "Key has been revoked");
  });

  it("should switch to a key by key name", { timeout: 20000 }, async () => {
    setupTestFailureHandler("should switch to a key by key name");

    // Create a key to switch to
    const keyName = `e2e-switch-key-${Date.now()}`;
    const createResult = await runCommand(
      ["auth", "keys", "create", keyName, "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    const createRecord = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    const createdKey = createRecord.key as Record<string, unknown>;
    const keyFullName = createdKey.keyName as string;

    // Switch requires a local account config to store the key.
    // Use ABLY_CLI_CONFIG_DIR to point at our temp config with a test account.
    const switchResult = await runCommand(
      ["auth", "keys", "switch", keyFullName, "--json"],
      {
        env: {
          ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "",
          ABLY_CLI_CONFIG_DIR: tempConfigDir,
        },
      },
    );

    expect(switchResult.exitCode).toBe(0);
    const switchRecord = parseNdjsonLines(switchResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    expect(switchRecord).toBeDefined();
    expect(switchRecord).toHaveProperty("success", true);
    const switchedKey = switchRecord.key as Record<string, unknown>;
    expect(switchedKey).toHaveProperty("appId", testAppId);
    expect(switchedKey).toHaveProperty("keyName", keyFullName);
    expect(switchedKey).toHaveProperty("keyLabel", keyName);
  });

  it(
    "should show current key after switching",
    { timeout: 25000 },
    async () => {
      setupTestFailureHandler("should show current key after switching");

      // Create a key and switch to it
      const keyName = `e2e-current-key-${Date.now()}`;
      const createResult = await runCommand(
        ["auth", "keys", "create", keyName, "--app", testAppId, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      const createRecord = parseNdjsonLines(createResult.stdout).find(
        (r) => r.type === "result",
      ) as Record<string, unknown>;
      const createdKey = createRecord.key as Record<string, unknown>;
      const keyFullName = createdKey.keyName as string;
      const keyValue = createdKey.key as string;

      // Switch to the key (writes to temp config)
      const switchResult = await runCommand(
        ["auth", "keys", "switch", keyFullName, "--json"],
        {
          env: {
            ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "",
            ABLY_CLI_CONFIG_DIR: tempConfigDir,
          },
        },
      );
      expect(switchResult.exitCode).toBe(0);

      // Verify current reads from the same temp config
      const currentResult = await runCommand(
        ["auth", "keys", "current", "--app", testAppId, "--json"],
        {
          env: {
            ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "",
            ABLY_CLI_CONFIG_DIR: tempConfigDir,
          },
        },
      );

      expect(currentResult.exitCode).toBe(0);
      const currentRecord = parseNdjsonLines(currentResult.stdout).find(
        (r) => r.type === "result",
      ) as Record<string, unknown>;
      expect(currentRecord).toBeDefined();
      expect(currentRecord).toHaveProperty("success", true);
      const currentKey = currentRecord.key as Record<string, unknown>;
      expect(currentKey).toHaveProperty("id", keyFullName);
      expect(currentKey).toHaveProperty("value", keyValue);
      expect(currentKey).toHaveProperty("label", keyName);
      const app = currentKey.app as Record<string, unknown>;
      expect(app).toHaveProperty("id", testAppId);
    },
  );
});
