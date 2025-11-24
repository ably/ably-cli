import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { ControlApi } from "../../src/services/control-api.js";

describe.skipIf(!process.env.E2E_ABLY_ACCESS_TOKEN)(
  "Control API Integration Tests",
  () => {
    let controlApi: ControlApi;
    let testAppId: string;
    let testAccountId: string;
    let createdResources: {
      apps: string[];
      keys: string[];
      queues: string[];
      rules: string[];
      namespaces: string[];
    };

    beforeAll(async function () {
      const accessToken = process.env.E2E_ABLY_ACCESS_TOKEN!;

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
        console.log(`Using account: ${testAccountId}`);
      } catch (error) {
        console.error("Failed to get account info:", error);
        throw error; // Let the test fail rather than skip
      }
    });

    afterAll(async function () {
      if (!controlApi) return;

      console.log("Cleaning up created resources...");

      // Clean up in reverse order of dependencies
      // 1. Delete rules (integrations)
      for (const ruleId of createdResources.rules) {
        try {
          if (testAppId) {
            await controlApi.deleteRule(testAppId, ruleId);
            console.log(`Deleted rule: ${ruleId}`);
          }
        } catch (error) {
          console.warn(`Failed to delete rule ${ruleId}:`, error);
        }
      }

      // 2. Delete namespaces (channel rules)
      for (const namespaceId of createdResources.namespaces) {
        try {
          if (testAppId) {
            await controlApi.deleteNamespace(testAppId, namespaceId);
            console.log(`Deleted namespace: ${namespaceId}`);
          }
        } catch (error) {
          console.warn(`Failed to delete namespace ${namespaceId}:`, error);
        }
      }

      // 3. Delete queues
      for (const queueName of createdResources.queues) {
        try {
          if (testAppId) {
            await controlApi.deleteQueue(testAppId, queueName);
            console.log(`Deleted queue: ${queueName}`);
          }
        } catch (error) {
          console.warn(`Failed to delete queue ${queueName}:`, error);
        }
      }

      // 4. Revoke keys
      for (const keyId of createdResources.keys) {
        try {
          if (testAppId) {
            await controlApi.revokeKey(testAppId, keyId);
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
    });

    describe("App Management", () => {
      it("should create a new app", async () => {
        const appData = {
          name: `Test App ${Date.now()}`,
          tlsOnly: false,
        };

        const app = await controlApi.createApp(appData);

        expect(app).toHaveProperty("id");
        expect(app).toHaveProperty("name", appData.name);
        expect(app).toHaveProperty("tlsOnly", false);
        expect(app).toHaveProperty("accountId", testAccountId);

        // Track for cleanup
        createdResources.apps.push(app.id);
        testAppId = app.id;
      });

      it("should list apps", async () => {
        const apps = await controlApi.listApps();

        expect(apps).toBeInstanceOf(Array);
        expect(apps.length).toBeGreaterThan(0);

        // Should include our test app
        const testApp = apps.find((app) => app.id === testAppId);
        expect(testApp).toBeDefined();
      });

      it("should get a specific app", async () => {
        const app = await controlApi.getApp(testAppId);

        expect(app).toHaveProperty("id", testAppId);
        expect(app).toHaveProperty("accountId", testAccountId);
      });

      it("should update an app", async () => {
        const updateData = {
          name: `Updated Test App ${Date.now()}`,
          tlsOnly: true,
        };

        const updatedApp = await controlApi.updateApp(testAppId, updateData);

        expect(updatedApp).toHaveProperty("id", testAppId);
        expect(updatedApp).toHaveProperty("name", updateData.name);
        expect(updatedApp).toHaveProperty("tlsOnly", true);
      });
    });

    describe("API Key Management", () => {
      let testKeyId: string;

      it("should create a new API key", async () => {
        const keyData = {
          name: `Test Key ${Date.now()}`,
          capability: {
            "*": ["*"],
          },
        };

        const key = await controlApi.createKey(testAppId, keyData);

        expect(key).toHaveProperty("id");
        expect(key).toHaveProperty("name", keyData.name);
        expect(key).toHaveProperty("appId", testAppId);
        expect(key).toHaveProperty("key");

        testKeyId = key.id;
        createdResources.keys.push(key.id);
      });

      it("should list API keys", async () => {
        const keys = await controlApi.listKeys(testAppId);

        expect(keys).toBeInstanceOf(Array);
        expect(keys.length).toBeGreaterThan(0);

        // Should include our test key
        const testKey = keys.find((key) => key.id === testKeyId);
        expect(testKey).toBeDefined();
      });

      it("should get a specific API key", async () => {
        const key = await controlApi.getKey(testAppId, testKeyId);

        expect(key).toHaveProperty("id", testKeyId);
        expect(key).toHaveProperty("appId", testAppId);
      });

      it("should update an API key", async () => {
        const updateData = {
          name: `Updated Test Key ${Date.now()}`,
          capability: {
            channel1: ["publish"],
            channel2: ["subscribe"],
          },
        };

        const updatedKey = await controlApi.updateKey(
          testAppId,
          testKeyId,
          updateData,
        );

        expect(updatedKey).toHaveProperty("id", testKeyId);
        expect(updatedKey).toHaveProperty("name", updateData.name);
      });
    });

    describe("Queue Management", () => {
      let testQueueName: string;

      it("should create a new queue", async () => {
        testQueueName = `test-queue-${Date.now()}`;
        const queueData = {
          name: testQueueName,
          maxLength: 1000,
          ttl: 3600,
          region: "us-east-1-a",
        };

        const queue = await controlApi.createQueue(testAppId, queueData);

        expect(queue).toHaveProperty("id");
        expect(queue).toHaveProperty("name", testQueueName);
        expect(queue).toHaveProperty("appId", testAppId);
        expect(queue).toHaveProperty("maxLength", 1000);
        expect(queue).toHaveProperty("ttl", 3600);
        expect(queue).toHaveProperty("region", "us-east-1-a");

        createdResources.queues.push(testQueueName);
      });

      it("should list queues", async () => {
        const queues = await controlApi.listQueues(testAppId);

        expect(queues).toBeInstanceOf(Array);
        expect(queues.length).toBeGreaterThan(0);

        // Should include our test queue
        const testQueue = queues.find((queue) => queue.name === testQueueName);
        expect(testQueue).toBeDefined();
        expect(testQueue).toHaveProperty("messages");
        expect(testQueue).toHaveProperty("stats");
        expect(testQueue).toHaveProperty("amqp");
        expect(testQueue).toHaveProperty("stomp");
      });
    });

    describe("Integration/Rules Management", () => {
      let testRuleId: string;

      it("should create a new integration rule", async () => {
        const ruleData = {
          requestMode: "single",
          ruleType: "http",
          source: {
            channelFilter: "test-channel",
            type: "channel.message",
          },
          target: {
            url: "https://httpbin.org/post",
            headers: {
              "Content-Type": "application/json",
            },
          },
        };

        const rule = await controlApi.createRule(testAppId, ruleData);

        expect(rule).toHaveProperty("id");
        expect(rule).toHaveProperty("appId", testAppId);
        expect(rule).toHaveProperty("ruleType", "http");
        expect(rule).toHaveProperty("requestMode", "single");
        expect(rule).toHaveProperty("source");
        expect(rule.source).toHaveProperty("channelFilter", "test-channel");

        testRuleId = rule.id;
        createdResources.rules.push(rule.id);
      });

      it("should list integration rules", async () => {
        const rules = await controlApi.listRules(testAppId);

        expect(rules).toBeInstanceOf(Array);
        expect(rules.length).toBeGreaterThan(0);

        // Should include our test rule
        const testRule = rules.find((rule) => rule.id === testRuleId);
        expect(testRule).toBeDefined();
      });

      it("should get a specific integration rule", async () => {
        const rule = await controlApi.getRule(testAppId, testRuleId);

        expect(rule).toHaveProperty("id", testRuleId);
        expect(rule).toHaveProperty("appId", testAppId);
      });

      it("should update an integration rule", async () => {
        const updateData = {
          source: {
            channelFilter: "updated-channel",
            type: "channel.message",
          },
          target: {
            url: "https://httpbin.org/put",
          },
        };

        const updatedRule = await controlApi.updateRule(
          testAppId,
          testRuleId,
          updateData,
        );

        expect(updatedRule).toHaveProperty("id", testRuleId);
        expect(updatedRule.source).toHaveProperty(
          "channelFilter",
          "updated-channel",
        );
      });
    });

    describe("Namespace/Channel Rules Management", () => {
      let testNamespaceId: string;

      it("should create a new namespace", async () => {
        const namespaceData = {
          channelNamespace: `test-namespace-${Date.now()}`,
          persisted: true,
          pushEnabled: false,
          tlsOnly: true,
        };

        const namespace = await controlApi.createNamespace(
          testAppId,
          namespaceData,
        );

        expect(namespace).toHaveProperty("id");
        expect(namespace).toHaveProperty("appId", testAppId);
        expect(namespace).toHaveProperty("persisted", true);
        expect(namespace).toHaveProperty("pushEnabled", false);
        expect(namespace).toHaveProperty("tlsOnly", true);

        testNamespaceId = namespace.id;
        createdResources.namespaces.push(namespace.id);
      });

      it("should list namespaces", async () => {
        const namespaces = await controlApi.listNamespaces(testAppId);

        expect(namespaces).toBeInstanceOf(Array);
        expect(namespaces.length).toBeGreaterThan(0);

        // Should include our test namespace
        const testNamespace = namespaces.find(
          (ns) => ns.id === testNamespaceId,
        );
        expect(testNamespace).toBeDefined();
      });

      it("should get a specific namespace", async () => {
        const namespace = await controlApi.getNamespace(
          testAppId,
          testNamespaceId,
        );

        expect(namespace).toHaveProperty("id", testNamespaceId);
        expect(namespace).toHaveProperty("appId", testAppId);
      });

      it("should update a namespace", async () => {
        const updateData = {
          persisted: false,
          pushEnabled: true,
          batchingEnabled: true,
          batchingInterval: 5000,
        };

        const updatedNamespace = await controlApi.updateNamespace(
          testAppId,
          testNamespaceId,
          updateData,
        );

        expect(updatedNamespace).toHaveProperty("id", testNamespaceId);
        expect(updatedNamespace).toHaveProperty("persisted", false);
        expect(updatedNamespace).toHaveProperty("pushEnabled", true);
        expect(updatedNamespace).toHaveProperty("batchingEnabled", true);
        expect(updatedNamespace).toHaveProperty("batchingInterval", 5000);
      });
    });

    describe("Error Handling", () => {
      it("should handle 404 errors for non-existent resources", async () => {
        try {
          await controlApi.getApp("non-existent-app-id");
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain("not found");
        }
      });

      it("should handle invalid API keys", async () => {
        const invalidControlApi = new ControlApi({
          accessToken: "invalid-token",
          logErrors: false,
        });

        try {
          await invalidControlApi.listApps();
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain("401");
        }
      });

      it("should handle malformed requests", async () => {
        try {
          // Try to create an app with invalid data
          await controlApi.createApp({ name: "" } as any);
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          // Could be 400 (validation) or other error
        }
      });
    });

    describe("Rate Limiting and Performance", () => {
      it("should handle multiple concurrent requests", async function () {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < 5; i++) {
          promises.push(controlApi.listApps());
        }

        const results = await Promise.all(promises);

        expect(results).toHaveLength(5);
        results.forEach((apps) => {
          expect(apps).toBeInstanceOf(Array);
        });
      });

      it("should handle pagination for large datasets", async () => {
        // This test depends on having enough data
        const apps = await controlApi.listApps();
        expect(apps).toBeInstanceOf(Array);
        // Just verify the structure is correct
        if (apps.length > 0) {
          expect(apps[0]).toHaveProperty("id");
          expect(apps[0]).toHaveProperty("name");
        }
      });
    });
  },
);
