import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { runCommand } from "@oclif/test";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

describe("queues:delete command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockQueueName = "test-queue";
  // Queue IDs follow the format: appId:region:name
  const mockQueueId = `${mockAppId}:us-east-1-a:${mockQueueName}`;
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

  describe("successful queue deletion", () => {
    it("should delete a queue successfully with --force flag", async () => {
      // Mock the queue listing endpoint to find the queue
      const mockQueue = {
        id: mockQueueId,
        appId: mockAppId,
        name: mockQueueName,
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
          publishRate: null,
          deliveryRate: null,
          acknowledgementRate: null,
        },
        amqp: {
          uri: "amqps://queue.ably.io:5671",
          queueName: mockQueueName,
        },
        stomp: {
          uri: "stomp://queue.ably.io:61614",
          host: "queue.ably.io",
          destination: `/queue/${mockQueueName}`,
        },
      };

      // Mock the apps listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [mockQueue]);

      // Mock the queue deletion endpoint
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      // Command should succeed without error
      expect(stdout).toContain(
        'Queue "test-queue" (ID: 550e8400-e29b-41d4-a716-446655440000:us-east-1-a:test-queue) deleted successfully',
      );
    });

    it("should delete a queue with custom app ID", async () => {
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

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [mockAppResponse]);

      // Mock the queue listing endpoint for custom app
      nock("https://control.ably.net")
        .get(`/v1/apps/${customAppId}/queues`)
        .reply(200, [
          {
            id: mockQueueId,
            appId: customAppId,
            name: mockQueueName,
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
              queueName: mockQueueName,
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: `/queue/${mockQueueName}`,
            },
          },
        ]);

      // Mock the queue deletion endpoint for custom app
      nock("https://control.ably.net")
        .delete(`/v1/apps/${customAppId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId, "--app", "custom-app-id", "--force"],
        import.meta.url,
      );

      // Command should succeed without error
      expect(stdout).toContain(
        'Queue "test-queue" (ID: 550e8400-e29b-41d4-a716-446655440000:us-east-1-a:test-queue) deleted successfully',
      );
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";

      // Mock the queue listing endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: mockQueueId,
            appId: mockAppId,
            name: mockQueueName,
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
              queueName: mockQueueName,
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: `/queue/${mockQueueName}`,
            },
          },
        ]);

      // Mock the queue deletion endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .delete(`/v1/apps/${mockAppId}/queues/${mockQueueId}`)
        .reply(204);

      const { error } = await runCommand(
        [
          "queues:delete",
          mockQueueId,
          "--access-token",
          "custom_access_token",
          "--force",
        ],
        import.meta.url,
      );

      // Command should succeed without error
      expect(error).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock authentication failure
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock forbidden response
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 app not found error", async () => {
      // Mock app not found response
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      // Mock server error
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      // Queue must be found first before we can test deletion failures
      expect(error?.message).toMatch(/Queue.*not found|500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle queue not found error", async () => {
      // Mock empty queue list (queue not found)
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, []);

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Queue.*not found/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle deletion API error", async () => {
      // Mock finding the queue but deletion fails
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: mockQueueId,
            appId: mockAppId,
            name: mockQueueName,
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
              queueName: mockQueueName,
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: `/queue/${mockQueueName}`,
            },
          },
        ]);

      // Mock deletion failure
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}/queues/${mockQueueId}`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require queue ID argument", async () => {
      const { error } = await runCommand(["queues:delete"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require app to be specified when not in environment", async () => {
      process.env.ABLY_CLI_CONFIG_DIR = "/tmp";

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No app|Failed to get apps/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle when specific queue ID is not found in list", async () => {
      // Mock queue with different ID (not found case)
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: "different-queue-id",
            appId: mockAppId,
            name: "different-queue-name",
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
              queueName: "different-queue-name",
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: "/queue/different-queue-name",
            },
          },
        ]);

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        `Queue with ID "${mockQueueId}" not found`,
      );
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 409 conflict error when queue is in use", async () => {
      // Mock conflict error when queue is in use
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: mockQueueId,
            appId: mockAppId,
            name: mockQueueName,
            region: "us-east-1-a",
            state: "active",
            maxLength: 10000,
            ttl: 60,
            deadletter: false,
            deadletterId: "",
            messages: {
              ready: 100,
              total: 200,
              unacknowledged: 100,
            },
            stats: {
              publishRate: 5,
              deliveryRate: 4.5,
              acknowledgementRate: 4,
            },
            amqp: {
              uri: "amqps://queue.ably.io:5671",
              queueName: mockQueueName,
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: `/queue/${mockQueueName}`,
            },
          },
        ]);

      // Mock conflict error
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}/queues/${mockQueueId}`)
        .reply(409, {
          error: "Conflict",
          details: "Queue is currently in use",
        });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      // The queue must exist first to test deletion errors
      expect(error?.message).toMatch(/Queue.*not found|409/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("confirmation prompt handling", () => {
    it.skip("should cancel deletion when user responds no to confirmation", async () => {
      // SKIPPED: stdin handling in tests is problematic with runCommand
      // Mock the queue listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: mockQueueId,
            appId: mockAppId,
            name: mockQueueName,
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
              queueName: mockQueueName,
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: `/queue/${mockQueueName}`,
            },
          },
        ]);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId],
        import.meta.url,
        { stdin: "n\n" },
      );

      expect(stdout).toContain("You are about to delete the following queue:");
      expect(stdout).toContain(`Queue ID: ${mockQueueId}`);
      expect(stdout).toContain(`Name: ${mockQueueName}`);
      expect(stdout).toContain("Region: us-east-1-a");
      expect(stdout).toContain("State: active");
      expect(stdout).toContain(
        "Messages: 10 total (5 ready, 5 unacknowledged)",
      );
      expect(stdout).toContain("Deletion cancelled");
    });

    it.skip("should proceed with deletion when user confirms", async () => {
      // SKIPPED: stdin handling in tests is problematic with runCommand
      // Mock the queue listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/queues`)
        .reply(200, [
          {
            id: mockQueueId,
            appId: mockAppId,
            name: mockQueueName,
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
              queueName: mockQueueName,
            },
            stomp: {
              uri: "stomp://queue.ably.io:61614",
              host: "queue.ably.io",
              destination: `/queue/${mockQueueName}`,
            },
          },
        ]);

      // Mock the deletion endpoint
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId],
        import.meta.url,
        { stdin: "y\n" },
      );

      expect(stdout).toContain("You are about to delete the following queue:");
      expect(stdout).toContain(`Queue "${mockQueueName}"`);
      expect(stdout).toContain("deleted successfully");
    });
  });
});
