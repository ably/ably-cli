import { describe, it, expect, afterEach } from "vitest";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
  CONTROL_HOST,
} from "../../../helpers/control-api-test-helpers.js";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";
import { mockQueue, mockApp } from "../../../fixtures/control-api.js";

describe("queues:list command", () => {
  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  describe("functionality", () => {
    it("should list multiple queues successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock the queue listing endpoint with multiple queues
      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [
          mockQueue({
            id: "queue-1",
            appId,
            name: "test-queue-1",
            messages: { ready: 5, total: 10, unacknowledged: 5 },
            stats: {
              publishRate: 1.5,
              deliveryRate: 1.2,
              acknowledgementRate: 1,
            },
            amqp: {
              uri: "amqps://queue.ably.io:5671",
              queueName: "test-queue-1",
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: "/queue/test-queue-1",
            },
          }),
          mockQueue({
            id: "queue-2",
            appId,
            name: "test-queue-2",
            region: "eu-west-1-a",
            maxLength: 50000,
            ttl: 3600,
            deadletter: true,
            deadletterId: "queue-2-dl",
            amqp: {
              uri: "amqps://queue.ably.io:5671",
              queueName: "test-queue-2",
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: "/queue/test-queue-2",
            },
          }),
        ]);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("Found 2 queues");
      expect(stdout).toContain("Queue ID: queue-1");
      expect(stdout).toContain("Name: test-queue-1");
      expect(stdout).toContain("Region: us-east-1-a");
      expect(stdout).toContain("State: active");
      expect(stdout).toContain("AMQP:");
      expect(stdout).toContain("STOMP:");
      expect(stdout).toContain("Messages:");
      expect(stdout).toContain("Ready: 5");
      expect(stdout).toContain("Unacknowledged: 5");
      expect(stdout).toContain("Total: 10");
      expect(stdout).toContain("Stats:");
      expect(stdout).toContain("Publish Rate: 1.5 msg/s");
      expect(stdout).toContain("Delivery Rate: 1.2 msg/s");
      expect(stdout).toContain("Acknowledgement Rate: 1 msg/s");
      expect(stdout).toContain("TTL: 60 seconds");
      expect(stdout).toContain("Max Length: 10000 messages");

      // Check second queue
      expect(stdout).toContain("Queue ID: queue-2");
      expect(stdout).toContain("Name: test-queue-2");
      expect(stdout).toContain("Region: eu-west-1-a");
      expect(stdout).toContain("TTL: 3600 seconds");
      expect(stdout).toContain("Max Length: 50000 messages");
      expect(stdout).toContain("Deadletter Queue ID: queue-2-dl");
    });

    it("should handle empty queue list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock empty queue list
      nockControl().get(`/v1/apps/${appId}/queues`).reply(200, []);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("No queues found");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueues = [
        mockQueue({
          id: "queue-1",
          appId,
          name: "test-queue-1",
          messages: { ready: 5, total: 10, unacknowledged: 5 },
          stats: {
            publishRate: 1.5,
            deliveryRate: 1.2,
            acknowledgementRate: 1,
          },
          amqp: {
            uri: "amqps://queue.ably.io:5671",
            queueName: "test-queue-1",
          },
          stomp: {
            uri: "stomp://queue.ably.io:61614",
            host: "queue.ably.io",
            destination: "/queue/test-queue-1",
          },
        }),
      ];

      nockControl().get(`/v1/apps/${appId}/queues`).reply(200, mockQueues);

      const { stdout } = await runCommand(
        ["queues:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "queues:list");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("appId", appId);
      expect(result).toHaveProperty("queues");
      expect(result.queues).toBeInstanceOf(Array);
      expect(result.queues).toHaveLength(1);
      expect(result.queues[0]).toHaveProperty("id", "queue-1");
      expect(result.queues[0]).toHaveProperty("name", "test-queue-1");
      expect(result).toHaveProperty("total", 1);
    });

    it("should use custom app ID when provided", async () => {
      const accountId = getMockConfigManager().getCurrentAccount()!.accountId;
      const customAppId = "custom-app-id";

      const mockAppResponse = mockApp({ id: customAppId, accountId });

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [mockAppResponse]);

      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [mockAppResponse]);

      nockControl()
        .get(`/v1/apps/${customAppId}/queues`)
        .reply(200, [
          mockQueue({
            id: "queue-1",
            appId: customAppId,
            name: "test-queue-1",
          }),
        ]);

      const { stdout } = await runCommand(
        ["queues:list", "--app", "custom-app-id"],
        import.meta.url,
      );

      // If there's no error, check stdout; otherwise the app resolution may have failed
      expect(stdout).toMatch(/Found 1 queue/);
      expect(stdout).toContain("Queue ID: queue-1");
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const customToken = "custom_access_token";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, []);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("No queues found");
    });

    it("should handle queues with no stats gracefully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock queue with no stats
      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [
          mockQueue({ id: "queue-1", appId, name: "test-queue-1" }),
        ]);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("Found 1 queues");
      expect(stdout).toContain("Queue ID: queue-1");
      // Should not show stats section when all stats are null
      expect(stdout).not.toContain("Stats:");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["queues:list"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(`/v1/apps/${appId}/queues`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });

    it("should handle 403 forbidden error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock forbidden response
      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 app not found error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock not found response
      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require app to be specified when not in environment", async () => {
      // Clear all accounts from the mock config to simulate no config
      getMockConfigManager().clearAccounts();

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No access token|No app|not logged in/i);
    });

    it("should handle errors in JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock server error for JSON output
      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["queues:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "queues:list");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("appId", appId);
    });

    it("should handle 429 rate limit error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock rate limit error
      nockControl().get(`/v1/apps/${appId}/queues`).reply(429, {
        error: "Rate limit exceeded",
        details: "Too many requests",
      });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/429/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("large datasets and pagination", () => {
    it("should handle large datasets correctly", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock a large number of queues to test performance
      const queues = Array.from({ length: 50 }, (_, i) =>
        mockQueue({
          id: `queue-${i + 1}`,
          appId,
          name: `test-queue-${i + 1}`,
          messages: { ready: i + 1, total: (i + 1) * 2, unacknowledged: i + 1 },
          amqp: {
            uri: "amqps://queue.ably.io:5671",
            queueName: `test-queue-${i + 1}`,
          },
          stomp: {
            uri: "stomp://queue.ably.io:61614",
            host: "queue.ably.io",
            destination: `/queue/test-queue-${i + 1}`,
          },
        }),
      );

      nockControl().get(`/v1/apps/${appId}/queues`).reply(200, queues);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("Found 50 queues");
      expect(stdout).toContain("Queue ID: queue-1");
      expect(stdout).toContain("Queue ID: queue-50");
    });

    it("should handle empty list in JSON format", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock empty queue list for JSON output
      nockControl().get(`/v1/apps/${appId}/queues`).reply(200, []);

      const { stdout } = await runCommand(
        ["queues:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "queues:list");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("appId", appId);
      expect(result).toHaveProperty("queues");
      expect(result.queues).toBeInstanceOf(Array);
      expect(result.queues).toHaveLength(0);
      expect(result).toHaveProperty("total", 0);
    });
  });

  standardHelpTests("queues:list", import.meta.url);
  standardArgValidationTests("queues:list", import.meta.url);
  standardFlagTests("queues:list", import.meta.url, ["--json"]);
});
