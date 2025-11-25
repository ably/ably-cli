import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import { ControlApi } from "../../../src/services/control-api.js";
import {
  runBackgroundProcessAndGetOutput,
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";

describe("Control API E2E Workflow Tests", () => {
  let controlApi: ControlApi;
  let testAccountId: string;
  let cliPath: string;
  let createdResources: {
    apps: string[];
    keys: string[];
    queues: string[];
    rules: string[];
    namespaces: string[];
  };
  let shouldSkip = false;

  beforeAll(async () => {
    process.on("SIGINT", forceExit);

    const accessToken = process.env.E2E_ABLY_ACCESS_TOKEN;
    if (!accessToken) {
      console.log(
        "E2E_ABLY_ACCESS_TOKEN not available, skipping Control API E2E tests",
      );
      shouldSkip = true;
      return;
    }

    // Set up CLI path and API client
    cliPath = "./bin/run.js";
    controlApi = new ControlApi({
      accessToken,
      logErrors: false,
    });

    // Initialize resource tracking
    createdResources = {
      apps: [],
      keys: [],
      queues: [],
      rules: [],
      namespaces: [],
    };

    try {
      // Get account info
      const meResponse = await controlApi.getMe();
      testAccountId = meResponse.account.id;
      console.log(`Running E2E tests for account: ${testAccountId}`);
    } catch (error) {
      console.error("Failed to get account info:", error);
      shouldSkip = true;
    }
  });

  afterAll(async () => {
    if (!controlApi) return;

    console.log("Cleaning up E2E test resources...");

    // Clean up in reverse order of dependencies
    // 1. Delete rules (integrations)
    for (const ruleId of createdResources.rules) {
      try {
        const appId = createdResources.apps[0]; // Use first app
        if (appId) {
          await controlApi.deleteRule(appId, ruleId);
          console.log(`Deleted rule: ${ruleId}`);
        }
      } catch (error) {
        console.warn(`Failed to delete rule ${ruleId}:`, error);
      }
    }

    // 2. Delete namespaces (channel rules)
    for (const namespaceId of createdResources.namespaces) {
      try {
        const appId = createdResources.apps[0];
        if (appId) {
          await controlApi.deleteNamespace(appId, namespaceId);
          console.log(`Deleted namespace: ${namespaceId}`);
        }
      } catch (error) {
        console.warn(`Failed to delete namespace ${namespaceId}:`, error);
      }
    }

    // 3. Delete queues
    for (const queueName of createdResources.queues) {
      try {
        const appId = createdResources.apps[0];
        if (appId) {
          await controlApi.deleteQueue(appId, queueName);
          console.log(`Deleted queue: ${queueName}`);
        }
      } catch (error) {
        console.warn(`Failed to delete queue ${queueName}:`, error);
      }
    }

    // 4. Revoke keys
    for (const keyId of createdResources.keys) {
      try {
        const appId = createdResources.apps[0];
        if (appId) {
          await controlApi.revokeKey(appId, keyId);
          console.log(`Revoked key: ${keyId}`);
        }
      } catch (error) {
        console.warn(`Failed to revoke key ${keyId}:`, error);
      }
    }

    // 5. Delete apps last
    for (const appId of createdResources.apps) {
      try {
        await controlApi.deleteApp(appId);
        console.log(`Deleted app: ${appId}`);
      } catch (error) {
        console.warn(`Failed to delete app ${appId}:`, error);
      }
    }
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    // Clear tracked output files and commands for this test
    testOutputFiles.clear();
    testCommands.length = 0;
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("Complete App Lifecycle Workflow", () => {
    it(
      "should create, update, and manage an app through CLI",
      async () => {
        setupTestFailureHandler(
          "should create, update, and manage an app through CLI",
        );

        if (shouldSkip) return;

        const appName = `E2E Test App ${Date.now()}`;

        // 1. Create app
        const createResult = await runBackgroundProcessAndGetOutput(
          `ABLY_ACCESS_TOKEN=${process.env.E2E_ABLY_ACCESS_TOKEN} ${cliPath} apps create --name "${appName}" --json`,
          30000,
        );

        expect(createResult.exitCode).toBe(0);
        const createOutput = JSON.parse(createResult.stdout);
        expect(createOutput).toHaveProperty("app");
        expect(createOutput.app).toHaveProperty("id");
        expect(createOutput.app).toHaveProperty("name", appName);

        const appId = createOutput.app.id;
        createdResources.apps.push(appId);

        // 2. List apps and verify our app is included
        const listResult = await runBackgroundProcessAndGetOutput(
          `ABLY_ACCESS_TOKEN=${process.env.E2E_ABLY_ACCESS_TOKEN} ${cliPath} apps list --json`,
          30000,
        );

        expect(listResult.exitCode).toBe(0);
        const listOutput = JSON.parse(listResult.stdout);
        expect(listOutput).toHaveProperty("apps");
        expect(Array.isArray(listOutput.apps)).toBe(true);

        const foundApp = listOutput.apps.find((app: any) => app.id === appId);
        expect(foundApp).toBeDefined();

        // 3. Update app
        const updatedName = `Updated ${appName}`;
        const updateResult = await runCommand(
          [
            "apps",
            "update",
            appId,
            "--name",
            updatedName,
            "--tls-only",
            "--json",
          ],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        expect(updateResult.stderr).toBe("");
        const updateOutput = JSON.parse(updateResult.stdout);
        expect(updateOutput).toHaveProperty("app");
        expect(updateOutput.app).toHaveProperty("name", updatedName);
        expect(updateOutput.app).toHaveProperty("tlsOnly", true);
      },
      { timeout: 30000 },
    );
  });

  describe("API Key Management Workflow", () => {
    let testAppId: string;

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create a test app first
      const appName = `E2E Key Test App ${Date.now()}`;
      const createResult = await runCommand(
        ["apps", "create", "--name", appName, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      testAppId = result.app.id;
    });

    afterAll(async () => {
      // Clean up test app if created
      if (testAppId) {
        try {
          await runCommand(["apps", "delete", testAppId, "--force"], {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          });
        } catch (error) {
          console.log("Error cleaning up test app:", error);
        }
      }
    });

    it("should create a new API key", async () => {
      setupTestFailureHandler("should create a new API key");

      if (shouldSkip) return;

      const keyName = `Test Key ${Date.now()}`;
      const createResult = await runCommand(
        [
          "auth",
          "keys",
          "create",
          "--app",
          testAppId,
          "--name",
          keyName,
          "--json",
        ],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.key).toHaveProperty("name", keyName);
      expect(result.key).toHaveProperty("key");
    });

    it("should list API keys", async () => {
      setupTestFailureHandler("should list API keys");

      if (shouldSkip) return;

      const listResult = await runCommand(
        ["auth", "keys", "list", "--app", testAppId, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(listResult.stdout);
      expect(result).toHaveProperty("success", true);
      expect(Array.isArray(result.keys)).toBe(true);
      expect(result.keys.length).toBeGreaterThan(0);
    });
  });

  describe("Queue Management Workflow", () => {
    let testAppId: string;

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create a test app first
      const appName = `E2E Queue Test App ${Date.now()}`;
      const createResult = await runCommand(
        ["apps", "create", "--name", appName, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      testAppId = result.app.id;
    });

    afterAll(async () => {
      // Clean up test app if created
      if (testAppId) {
        try {
          await runCommand(["apps", "delete", testAppId, "--force"], {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          });
        } catch (error) {
          console.log("Error cleaning up test app:", error);
        }
      }
    });

    it("should create a new queue", async () => {
      setupTestFailureHandler("should create a new queue");

      if (shouldSkip) return;

      const queueName = `test-queue-${Date.now()}`;
      const createResult = await runCommand(
        [
          "queues",
          "create",
          "--app",
          testAppId,
          "--name",
          queueName,
          "--max-length",
          "5000",
          "--ttl",
          "1800",
          "--region",
          "eu-west-1-a",
          "--json",
        ],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.queue).toHaveProperty("name", queueName);
      expect(result.queue).toHaveProperty("maxLength", 5000);
      expect(result.queue).toHaveProperty("ttl", 1800);
    });

    it("should list queues", async () => {
      setupTestFailureHandler("should list queues");

      if (shouldSkip) return;

      const listResult = await runCommand(
        ["queues", "list", "--app", testAppId, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(listResult.stdout);
      expect(result).toHaveProperty("success", true);
      expect(Array.isArray(result.queues)).toBe(true);
    });

    it("should delete a queue", async () => {
      setupTestFailureHandler("should delete a queue");

      if (shouldSkip) return;

      const queueName = `test-delete-queue-${Date.now()}`;
      // First create a queue
      await runCommand(
        ["queues", "create", "--app", testAppId, "--name", queueName, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const deleteResult = await runCommand(
        ["queues", "delete", queueName, "--app", testAppId, "--force"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      expect(deleteResult.stderr).toBe("");
      expect(deleteResult.stdout).toContain("deleted successfully");

      // Remove from cleanup list since we deleted it
      const index = createdResources.queues.indexOf(queueName);
      if (index !== -1) {
        createdResources.queues.splice(index, 1);
      }
    });
  });

  describe("Integration Rules Workflow", () => {
    let testAppId: string;

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create a test app first
      const appName = `E2E Integration Test App ${Date.now()}`;
      const createResult = await runCommand(
        ["apps", "create", "--name", appName, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      testAppId = result.app.id;
    });

    afterAll(async () => {
      // Clean up test app if created
      if (testAppId) {
        try {
          await runCommand(["apps", "delete", testAppId, "--force"], {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          });
        } catch (error) {
          console.log("Error cleaning up test app:", error);
        }
      }
    });

    it("should create a new integration rule", async () => {
      setupTestFailureHandler("should create a new integration rule");

      if (shouldSkip) return;

      const createResult = await runCommand(
        [
          "integrations",
          "create",
          "--app",
          testAppId,
          "--rule-type",
          "http",
          "--channel-filter",
          "e2e-test-*",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://httpbin.org/post",
          "--json",
        ],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.rule).toHaveProperty("ruleType", "http");
      expect(result.rule).toHaveProperty("source");
      expect(result.rule.source).toHaveProperty("channelFilter", "e2e-test-*");
    });

    it("should list integration rules", async () => {
      setupTestFailureHandler("should list integration rules");

      if (shouldSkip) return;

      const listResult = await runCommand(
        ["integrations", "list", "--app", testAppId, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(listResult.stdout);
      expect(result).toHaveProperty("success", true);
      expect(Array.isArray(result.rules)).toBe(true);
      expect(result.rules.length).toBeGreaterThan(0);
    });
  });

  describe("Channel Rules Workflow", () => {
    let testAppId: string;

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create a test app first
      const appName = `E2E Channel Rules Test App ${Date.now()}`;
      const createResult = await runCommand(
        ["apps", "create", "--name", appName, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        },
      );

      const result = JSON.parse(createResult.stdout);
      testAppId = result.app.id;
    });

    afterAll(async () => {
      // Clean up test app if created
      if (testAppId) {
        try {
          await runCommand(["apps", "delete", testAppId, "--force"], {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          });
        } catch (error) {
          console.log("Error cleaning up test app:", error);
        }
      }
    });

    it(
      "should create and manage channel rules through CLI",
      async () => {
        setupTestFailureHandler(
          "should create and manage channel rules through CLI",
        );

        if (shouldSkip) return;

        const ruleName = `e2e-channel-rule-${Date.now()}`;

        // 1. Create channel rule
        const createResult = await runCommand(
          [
            "channel-rule",
            "create",
            "--app",
            testAppId,
            "--name",
            ruleName,
            "--persisted",
            "--push-enabled",
            "--authenticated",
            "--json",
          ],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        expect(createResult.stderr).toBe("");
        const createOutput = JSON.parse(createResult.stdout);
        expect(createOutput).toHaveProperty("rule");
        expect(createOutput.rule).toHaveProperty("id");
        expect(createOutput.rule).toHaveProperty("name", ruleName);
        expect(createOutput.rule).toHaveProperty("persisted", true);
        expect(createOutput.rule).toHaveProperty("pushEnabled", true);
        expect(createOutput.rule).toHaveProperty("authenticated", true);

        const namespaceId = createOutput.rule.id;
        createdResources.namespaces.push(namespaceId);

        // 2. List channel rules and verify our rule is included
        const listResult = await runCommand(
          ["channel-rule", "list", "--app", testAppId, "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        expect(listResult.stderr).toBe("");
        const listOutput = JSON.parse(listResult.stdout);
        expect(listOutput).toHaveProperty("namespaces");
        expect(Array.isArray(listOutput.namespaces)).toBe(true);

        const foundRule = listOutput.namespaces.find(
          (ns: any) => ns.id === namespaceId,
        );
        expect(foundRule).toBeDefined();
        expect(foundRule).toHaveProperty("persisted", true);
        expect(foundRule).toHaveProperty("pushEnabled", true);
      },
      { timeout: 20000 },
    );
  });

  describe("Error Handling and Edge Cases", () => {
    it(
      "should handle invalid access tokens gracefully",
      async () => {
        setupTestFailureHandler(
          "should handle invalid access tokens gracefully",
        );

        if (shouldSkip) return;

        const result = await runCommand(["apps", "list", "--json"], {
          env: { ...process.env, ABLY_ACCESS_TOKEN: "invalid-token" },
        });

        // Should fail with authentication error
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr + result.stdout).toContain("401");
      },
      { timeout: 10000 },
    );

    it(
      "should handle non-existent resources",
      async () => {
        setupTestFailureHandler("should handle non-existent resources");

        if (shouldSkip) return;

        const result = await runCommand(
          ["apps", "update", "non-existent-app-id", "--name", "Test", "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr + result.stdout).toContain("404");
      },
      { timeout: 10000 },
    );

    it(
      "should validate required parameters",
      async () => {
        setupTestFailureHandler("should validate required parameters");

        if (shouldSkip) return;

        const result = await runCommand(["apps", "create"], {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        });

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr + result.stdout).toContain(
          "Missing required flag",
        );
      },
      { timeout: 10000 },
    );
  });

  describe("Cross-Command Workflows", () => {
    it(
      "should handle complete app setup workflow",
      async () => {
        setupTestFailureHandler("should handle complete app setup workflow");

        if (shouldSkip) return;

        const timestamp = Date.now();
        const appName = `E2E Complete Workflow ${timestamp}`;
        const keyName = `E2E Workflow Key ${timestamp}`;
        const queueName = `e2e-workflow-queue-${timestamp}`;

        // 1. Create app
        const createAppResult = await runCommand(
          ["apps", "create", "--name", appName, "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const appOutput = JSON.parse(createAppResult.stdout);
        const appId = appOutput.app.id;
        createdResources.apps.push(appId);

        // 2. Create API key
        const createKeyResult = await runCommand(
          [
            "auth",
            "keys",
            "create",
            "--app",
            appId,
            "--name",
            keyName,
            "--json",
          ],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const keyOutput = JSON.parse(createKeyResult.stdout);
        const keyId = keyOutput.key.id;
        createdResources.keys.push(keyId);

        // 3. Create queue
        const createQueueResult = await runCommand(
          ["queues", "create", "--app", appId, "--name", queueName, "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const queueOutput = JSON.parse(createQueueResult.stdout);
        expect(queueOutput).toHaveProperty("name", queueName);
        createdResources.queues.push(queueName);

        // 4. Create integration
        const createIntegrationResult = await runCommand(
          [
            "integrations",
            "create",
            "--app",
            appId,
            "--rule-type",
            "http",
            "--channel-filter",
            "workflow-test",
            "--source-type",
            "channel.message",
            "--target-url",
            "https://httpbin.org/post",
            "--json",
          ],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const integrationOutput = JSON.parse(createIntegrationResult.stdout);
        const ruleId = integrationOutput.id;
        createdResources.rules.push(ruleId);

        // 5. Verify all resources exist by listing them
        const listAppsResult = await runCommand(["apps", "list", "--json"], {
          env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
        });

        const appsOutput = JSON.parse(listAppsResult.stdout);
        expect(
          appsOutput.apps.find((app: any) => app.id === appId),
        ).toBeDefined();

        const listKeysResult = await runCommand(
          ["auth", "keys", "list", "--app", appId, "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const keysOutput = JSON.parse(listKeysResult.stdout);
        expect(
          keysOutput.keys.find((key: any) => key.id === keyId),
        ).toBeDefined();

        const listQueuesResult = await runCommand(
          ["queues", "list", "--app", appId, "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const queuesOutput = JSON.parse(listQueuesResult.stdout);
        expect(
          queuesOutput.queues.find((queue: any) => queue.name === queueName),
        ).toBeDefined();

        const listIntegrationsResult = await runCommand(
          ["integrations", "list", "--app", appId, "--json"],
          {
            env: { ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN },
          },
        );

        const integrationsOutput = JSON.parse(listIntegrationsResult.stdout);
        expect(
          integrationsOutput.rules.find((rule: any) => rule.id === ruleId),
        ).toBeDefined();
      },
      { timeout: 45000 },
    );
  });
});
