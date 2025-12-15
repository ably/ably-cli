import { describe, it, expect, afterEach } from "vitest";
import nock from "nock";
import { runCommand } from "@oclif/test";
import {
  DEFAULT_TEST_CONFIG,
  getMockConfigManager,
} from "../../../helpers/mock-config-manager.js";

// Pre-define constants using DEFAULT_TEST_CONFIG
const mockAppId = DEFAULT_TEST_CONFIG.appId;
const mockAccountId = DEFAULT_TEST_CONFIG.accountId;
const mockQueueName = "test-queue";
const mockQueueId = "queue-550e8400-e29b-41d4-a716-446655440000";

// Mock data for successful responses
const mockAccountResponse = {
  account: { id: mockAccountId, name: "Test Account" },
  user: { email: "test@example.com" },
};

const mockAppResponse = {
  id: mockAppId,
  accountId: mockAccountId,
  name: "Test App",
  status: "active",
  created: Date.now(),
  modified: Date.now(),
  tlsOnly: false,
};

const mockQueueResponse = {
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
    queueName: "test-queue",
  },
  stomp: {
    uri: "stomp://queue.ably.io:61614",
    host: "queue.ably.io",
    destination: "/queue/test-queue",
  },
};

describe("queues:create command", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful queue creation", () => {
    it("should create a queue successfully with default settings", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock the apps listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [mockAppResponse]);

      // Mock the queue creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`, {
          name: mockQueueName,
          maxLength: 10000,
          region: "us-east-1-a",
          ttl: 60,
        })
        .reply(201, mockQueueResponse);

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created successfully");
      expect(stdout).toContain(`Queue ID: ${mockQueueId}`);
      expect(stdout).toContain(`Name: ${mockQueueName}`);
      expect(stdout).toContain("Region: us-east-1-a");
      expect(stdout).toContain("TTL: 60 seconds");
      expect(stdout).toContain("Max Length: 10000 messages");
      expect(stdout).toContain("AMQP Connection Details");
      expect(stdout).toContain("STOMP Connection Details");
    });

    it("should create a queue with custom settings", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock the queue creation endpoint with custom settings
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`, {
          name: mockQueueName,
          maxLength: 50000,
          region: "eu-west-1-a",
          ttl: 3600,
        })
        .reply(201, {
          ...mockQueueResponse,
          region: "eu-west-1-a",
          maxLength: 50000,
          ttl: 3600,
        });

      const { stdout } = await runCommand(
        [
          "queues:create",
          "--name",
          mockQueueName,
          "--max-length",
          "50000",
          "--region",
          "eu-west-1-a",
          "--ttl",
          "3600",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created successfully");
      expect(stdout).toContain("Region: eu-west-1-a");
      expect(stdout).toContain("TTL: 3600 seconds");
      expect(stdout).toContain("Max Length: 50000 messages");
    });

    it("should output JSON format when --json flag is used", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(201, mockQueueResponse);

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("id", mockQueueId);
      expect(result).toHaveProperty("name", mockQueueName);
      expect(result).toHaveProperty("region", "us-east-1-a");
    });

    it("should use custom app ID when provided", async () => {
      const customAppId = "custom-app-id";

      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock the apps listing endpoint to find the custom app
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            ...mockAppResponse,
            id: customAppId,
            name: customAppId,
          },
        ]);

      nock("https://control.ably.net")
        .post(`/v1/apps/${customAppId}/queues`)
        .reply(201, {
          ...mockQueueResponse,
          appId: customAppId,
        });

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName, "--app", "custom-app-id"],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created successfully");
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";

      // Mock the /me endpoint to get account info
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock the apps listing endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [mockAppResponse]);

      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(201, mockQueueResponse);

      const { stdout } = await runCommand(
        [
          "queues:create",
          "--name",
          mockQueueName,
          "--access-token",
          "custom_access_token",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created successfully");
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock authentication failure
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock forbidden response
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 app not found error", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock not found response
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock server error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require name parameter", async () => {
      const { error } = await runCommand(["queues:create"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag/);
      expect(error?.message).toMatch(/name/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require app to be specified when not in environment", async () => {
      // Clear all accounts from the mock config to simulate no config
      getMockConfigManager().clearAccounts();

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No access token|No app|not logged in/i);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock network error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle validation errors from API", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock validation error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(400, {
          error: "Validation failed",
          details: "Queue name already exists",
        });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/400/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 429 rate limit error", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      // Mock quota exceeded error
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`)
        .reply(429, {
          error: "Rate limit exceeded",
          details: "Too many requests",
        });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/429/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("parameter validation", () => {
    it("should accept minimum valid parameter values", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`, {
          name: mockQueueName,
          maxLength: 1,
          region: "us-east-1-a",
          ttl: 1,
        })
        .reply(201, {
          ...mockQueueResponse,
          maxLength: 1,
          ttl: 1,
        });

      const { stdout } = await runCommand(
        [
          "queues:create",
          "--name",
          mockQueueName,
          "--max-length",
          "1",
          "--ttl",
          "1",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created successfully");
      expect(stdout).toContain("TTL: 1 seconds");
      expect(stdout).toContain("Max Length: 1 messages");
    });

    it("should accept large parameter values and different regions", async () => {
      // Mock the /me endpoint to get account info
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, mockAccountResponse);

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/queues`, {
          name: mockQueueName,
          maxLength: 1000000,
          region: "ap-southeast-2-a",
          ttl: 86400,
        })
        .reply(201, {
          ...mockQueueResponse,
          region: "ap-southeast-2-a",
          maxLength: 1000000,
          ttl: 86400,
        });

      const { stdout } = await runCommand(
        [
          "queues:create",
          "--name",
          mockQueueName,
          "--max-length",
          "1000000",
          "--region",
          "ap-southeast-2-a",
          "--ttl",
          "86400",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created successfully");
      expect(stdout).toContain("Region: ap-southeast-2-a");
      expect(stdout).toContain("TTL: 86400 seconds");
      expect(stdout).toContain("Max Length: 1000000 messages");
    });
  });
});
