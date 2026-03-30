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
import { mockQueue } from "../../../fixtures/control-api.js";

describe("queues:create command", () => {
  const mockQueueName = "test-queue";
  const mockQueueId = "queue-550e8400-e29b-41d4-a716-446655440000";

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  function createMockQueueResponse(appId: string) {
    return mockQueue({ id: mockQueueId, appId, name: mockQueueName });
  }

  describe("functionality", () => {
    it("should create a queue successfully with default settings", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, accountId, name: "Test App" }]);

      nockControl()
        .post(`/v1/apps/${appId}/queues`, {
          name: mockQueueName,
          maxLength: 10000,
          region: "us-east-1-a",
          ttl: 60,
        })
        .reply(201, createMockQueueResponse(appId));

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created:");
      expect(stdout).toContain(`Queue ID: ${mockQueueId}`);
      expect(stdout).toContain(`Name: ${mockQueueName}`);
      expect(stdout).toContain("Region: us-east-1-a");
      expect(stdout).toContain("TTL: 60 seconds");
      expect(stdout).toContain("Max Length: 10000 messages");
      expect(stdout).toContain("AMQP Connection Details");
      expect(stdout).toContain("STOMP Connection Details");
    });

    it("should create a queue with custom settings", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .post(`/v1/apps/${appId}/queues`, {
          name: mockQueueName,
          maxLength: 5000,
          region: "eu-west-1-a",
          ttl: 3600,
        })
        .reply(201, {
          ...createMockQueueResponse(appId),
          region: "eu-west-1-a",
          maxLength: 5000,
          ttl: 3600,
        });

      const { stdout } = await runCommand(
        [
          "queues:create",
          "--name",
          mockQueueName,
          "--max-length",
          "5000",
          "--region",
          "eu-west-1-a",
          "--ttl",
          "3600",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created:");
      expect(stdout).toContain("Region: eu-west-1-a");
      expect(stdout).toContain("TTL: 3600 seconds");
      expect(stdout).toContain("Max Length: 5000 messages");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .post(`/v1/apps/${appId}/queues`)
        .reply(201, createMockQueueResponse(appId));

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "queues:create");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("queue");
      expect(result.queue).toHaveProperty("id", mockQueueId);
      expect(result.queue).toHaveProperty("name", mockQueueName);
      expect(result.queue).toHaveProperty("region", "us-east-1-a");
    });

    it("should use custom app ID when provided", async () => {
      const accountId = getMockConfigManager().getCurrentAccount()!.accountId!;
      const customAppId = "custom-app-id";

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: customAppId, accountId, name: customAppId }]);

      nockControl()
        .post(`/v1/apps/${customAppId}/queues`)
        .reply(201, {
          ...createMockQueueResponse(customAppId),
          appId: customAppId,
        });

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName, "--app", "custom-app-id"],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created:");
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
      const customToken = "custom_access_token";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, accountId, name: "Test App" }]);

      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .post(`/v1/apps/${appId}/queues`)
        .reply(201, createMockQueueResponse(appId));

      const { stdout } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created:");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["queues:create", "--name", mockQueueName],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const mockConfig = getMockConfigManager();
        const appId = mockConfig.getCurrentAppId()!;
        const accountId = mockConfig.getCurrentAccount()!.accountId!;
        // Pre-mock /v1/me (needed for app resolution)
        nockControl()
          .get("/v1/me")
          .reply(200, {
            account: { id: accountId, name: "Test Account" },
            user: { email: "test@example.com" },
          });
        const scope = nockControl().post(`/v1/apps/${appId}/queues`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });

    it("should handle 403 forbidden error", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .post(`/v1/apps/${appId}/queues`)
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
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .post(`/v1/apps/${appId}/queues`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
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
      getMockConfigManager().clearAccounts();

      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No access token|No app|not logged in/i);
    });

    it("should handle validation errors from API", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl().post(`/v1/apps/${appId}/queues`).reply(400, {
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
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl().post(`/v1/apps/${appId}/queues`).reply(429, {
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
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .post(`/v1/apps/${appId}/queues`, {
          name: mockQueueName,
          maxLength: 1,
          region: "us-east-1-a",
          ttl: 1,
        })
        .reply(201, {
          ...createMockQueueResponse(appId),
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

      expect(stdout).toContain("Queue created:");
      expect(stdout).toContain("TTL: 1 seconds");
      expect(stdout).toContain("Max Length: 1 messages");
    });

    it("should accept max parameter values and different regions", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .post(`/v1/apps/${appId}/queues`, {
          name: mockQueueName,
          maxLength: 10000,
          region: "ap-southeast-2-a",
          ttl: 3600,
        })
        .reply(201, {
          ...createMockQueueResponse(appId),
          region: "ap-southeast-2-a",
          maxLength: 10000,
          ttl: 3600,
        });

      const { stdout } = await runCommand(
        [
          "queues:create",
          "--name",
          mockQueueName,
          "--max-length",
          "10000",
          "--region",
          "ap-southeast-2-a",
          "--ttl",
          "3600",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Queue created:");
      expect(stdout).toContain("Region: ap-southeast-2-a");
      expect(stdout).toContain("TTL: 3600 seconds");
      expect(stdout).toContain("Max Length: 10000 messages");
    });

    it("should reject max-length exceeding 10000", async () => {
      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName, "--max-length", "10001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("max-length must not exceed 10000.");
    });

    it("should reject ttl exceeding 3600", async () => {
      const { error } = await runCommand(
        ["queues:create", "--name", mockQueueName, "--ttl", "3601"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("ttl must not exceed 3600 seconds.");
    });
  });

  standardHelpTests("queues:create", import.meta.url);
  standardArgValidationTests("queues:create", import.meta.url);
  standardFlagTests("queues:create", import.meta.url, ["--name", "--json"]);
});
