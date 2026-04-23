import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
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

  beforeAll(async () => {
    ({ appId: testAppId, teardown: teardownApp } =
      await createTestApp("e2e-keys-test"));
  });

  afterAll(async () => {
    await teardownApp?.();
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

    // Now get that key by its name
    const getResult = await runCommand(
      ["auth", "keys", "get", keyFullName, "--app", testAppId, "--json"],
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
    const updateResult = await runCommand(
      [
        "auth",
        "keys",
        "update",
        keyFullName,
        "--app",
        testAppId,
        "--name",
        updatedName,
        "--json",
      ],
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
});
