import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { runCommand } from "@oclif/test";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

describe("queues:list command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  let testConfigDir: string;
  let originalConfigDir: string;

  const mockAccountResponse = {
    account: { id: mockAccountId, name: "Test Account" },
    user: { email: "test@example.com" },
  };

  beforeEach(() => {
    // Set environment variable for access token
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    // Create a temporary config directory for testing
    testConfigDir = path.join(os.tmpdir(), `ably-cli-test-${Date.now()}`);
    fs.mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    // Create a minimal config file with a default account
    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"
`;
    fs.writeFileSync(path.join(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    // Clean up nock interceptors
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;

    // Restore original config directory
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("successful queue listing", () => {
    it("should list multiple queues successfully", async () => {
      // Mock the queue listing endpoint with multiple queues
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: "queue-1",
            appId: mockAppId,
            name: "test-queue-1",
            region: "us-east-1-a",
            state: "active",
            maxLength: 10000,
            ttl: 60,
            deadletter: false,
            deadletterId: "",
            messages: {
              ready: 5,
              total: 10,
              unacknowledged: 5,
            },
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
          },
          {
            id: "queue-2",
            appId: mockAppId,
            name: "test-queue-2",
            region: "eu-west-1-a",
            state: "active",
            maxLength: 50000,
            ttl: 3600,
            deadletter: true,
            deadletterId: "queue-2-dl",
            messages: {
              ready: 0,
              total: 0,
              unacknowledged: 0,
            },
            stats: {
              publishRate: null,
              deliveryRate: null,
              acknowledgementRate: null,
            },
            amqp: {
              uri: "amqps://queue.ably.io:5671",
              queueName: "test-queue-2",
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: "/queue/test-queue-2",
            },
          },
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
      // Mock empty queue list
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, []);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("No queues found");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockQueues = [
        {
          id: "queue-1",
          appId: mockAppId,
          name: "test-queue-1",
          region: "us-east-1-a",
          state: "active",
          maxLength: 10000,
          ttl: 60,
          deadletter: false,
          deadletterId: "",
          messages: {
            ready: 5,
            total: 10,
            unacknowledged: 5,
          },
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
        },
      ];

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, mockQueues);

      const { stdout } = await runCommand(
        ["queues:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("appId", mockAppId);
      expect(result).toHaveProperty("queues");
      expect(result.queues).toBeInstanceOf(Array);
      expect(result.queues).toHaveLength(1);
      expect(result.queues[0]).toHaveProperty("id", "queue-1");
      expect(result.queues[0]).toHaveProperty("name", "test-queue-1");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("total", 1);
    });

    it("should use custom app ID when provided", async () => {
      const customAppId = "custom-app-id";

      const mockAppResponse = {
        id: customAppId,
        accountId: mockAccountId,
        name: "Test App",
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
      };

      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // nock("https://control.ably.net")
      //   .get("/v1/me")
      //   .reply(200, mockAccountResponse);

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [mockAppResponse]);

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [mockAppResponse]);

      nock("https://control.ably.net")
        .get(`/v1/apps/${customAppId}/queues`)
        .reply(200, [
          {
            id: "queue-1",
            appId: customAppId,
            name: "test-queue-1",
            region: "us-east-1-a",
            state: "active",
            maxLength: 10000,
            ttl: 60,
            deadletter: false,
            deadletterId: "",
            messages: {
              ready: 0,
              total: 0,
              unacknowledged: 0,
            },
            stats: {
              publishRate: null,
              deliveryRate: null,
              acknowledgementRate: null,
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
          },
        ]);

      const { stdout } = await runCommand(
        ["queues:list", "--app", "custom-app-id"],
        import.meta.url,
      );

      // If there's no error, check stdout; otherwise the app resolution may have failed
      expect(stdout).toMatch(/Found 1 queue/);
      expect(stdout).toContain("Queue ID: queue-1");
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";

      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["queues:list", "--access-token", "custom_access_token"],
        import.meta.url,
      );

      expect(stdout).toContain("No queues found");
    });

    it("should handle queues with no stats gracefully", async () => {
      // Mock queue with no stats
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: "queue-1",
            appId: mockAppId,
            name: "test-queue-1",
            region: "us-east-1-a",
            state: "active",
            maxLength: 10000,
            ttl: 60,
            deadletter: false,
            deadletterId: "",
            messages: {
              ready: 0,
              total: 0,
              unacknowledged: 0,
            },
            stats: {
              publishRate: null,
              deliveryRate: null,
              acknowledgementRate: null,
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
          },
        ]);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("Found 1 queues");
      expect(stdout).toContain("Queue ID: queue-1");
      // Should not show stats section when all stats are null
      expect(stdout).not.toContain("Stats:");
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock authentication failure
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock forbidden response
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 app not found error", async () => {
      // Mock not found response
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      // Mock server error
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require app to be specified when not in environment", async () => {
      process.env.ABLY_CLI_CONFIG_DIR = "/tmp";

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No app|Failed to get apps/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .replyWithError("Network error");

      const { error } = await runCommand(["queues:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle errors in JSON format when --json flag is used", async () => {
      // Mock server error for JSON output
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["queues:list", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain('"success": false');
      expect(stdout).toContain('"status": "error"');
      expect(stdout).toContain('"error":');
      expect(stdout).toContain(`"appId": "${mockAppId}"`);
    });

    it("should handle 429 rate limit error", async () => {
      // Mock rate limit error
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(429, {
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
      // Mock a large number of queues to test performance
      const queues: any[] = [];
      for (let i = 1; i <= 50; i++) {
        queues.push({
          id: `queue-${i}`,
          appId: mockAppId,
          name: `test-queue-${i}`,
          region: "us-east-1-a",
          state: "active",
          maxLength: 10000,
          ttl: 60,
          deadletter: false,
          deadletterId: "",
          messages: {
            ready: i,
            total: i * 2,
            unacknowledged: i,
          },
          stats: {
            publishRate: null,
            deliveryRate: null,
            acknowledgementRate: null,
          },
          amqp: {
            uri: "amqps://queue.ably.io:5671",
            queueName: `test-queue-${i}`,
          },
          stomp: {
            uri: "stomp://queue.ably.io:61614",
            host: "queue.ably.io",
            destination: `/queue/test-queue-${i}`,
          },
        });
      }

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, queues);

      const { stdout } = await runCommand(["queues:list"], import.meta.url);

      expect(stdout).toContain("Found 50 queues");
      expect(stdout).toContain("Queue ID: queue-1");
      expect(stdout).toContain("Queue ID: queue-50");
    });

    it("should handle empty list in JSON format", async () => {
      // Mock empty queue list for JSON output
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["queues:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("appId", mockAppId);
      expect(result).toHaveProperty("queues");
      expect(result.queues).toBeInstanceOf(Array);
      expect(result.queues).toHaveLength(0);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("total", 0);
    });
  });
});
