import { describe, it, expect, afterEach } from "vitest";
import { Readable } from "node:stream";
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

describe("queues:delete command", () => {
  const mockQueueName = "test-queue";

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  function createMockQueue(appId: string, queueId: string) {
    return mockQueue({
      id: queueId,
      appId,
      name: mockQueueName,
      messages: { ready: 5, total: 10, unacknowledged: 5 },
    });
  }

  describe("functionality", () => {
    it("should delete a queue successfully with --force flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      nockControl()
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("Queue deleted:");
    });

    it("should delete a queue with custom app ID", async () => {
      const accountId = getMockConfigManager().getCurrentAccount()!.accountId!;
      const customAppId = "custom-app-id";
      const mockQueueId = `${customAppId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: customAppId, accountId, name: "Test App" }]);

      nockControl()
        .get(`/v1/apps/${customAppId}/queues`)
        .reply(200, [createMockQueue(customAppId, mockQueueId)]);

      nockControl()
        .delete(`/v1/apps/${customAppId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId, "--app", "custom-app-id", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("Queue deleted:");
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;
      const customToken = "custom_access_token";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
        .reply(204);

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      get commandArgs() {
        const appId = getMockConfigManager().getCurrentAppId()!;
        return [
          "queues:delete",
          `${appId}:us-east-1-a:${mockQueueName}`,
          "--force",
        ];
      },
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
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle queue not found error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl().get(`/v1/apps/${appId}/queues`).reply(200, []);

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Queue.*not found/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle deletion API error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      nockControl()
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
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
      getMockConfigManager().clearAccounts();
      const mockQueueId = "some-app:us-east-1-a:test-queue";

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No access token|No app|not logged in/i);
    });

    it("should handle when specific queue ID is not found in list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [
          {
            id: "different-queue-id",
            appId,
            name: "different-queue-name",
            region: "us-east-1-a",
            state: "active",
            maxLength: 10000,
            ttl: 60,
            deadletter: false,
            deadletterId: "",
            messages: { ready: 0, total: 0, unacknowledged: 0 },
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [
          {
            ...createMockQueue(appId, mockQueueId),
            messages: { ready: 100, total: 200, unacknowledged: 100 },
            stats: {
              publishRate: 5,
              deliveryRate: 4.5,
              acknowledgementRate: 4,
            },
          },
        ]);

      nockControl()
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
        .reply(409, {
          error: "Conflict",
          details: "Queue is currently in use",
        });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Queue.*not found|409/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("confirmation prompt handling", () => {
    const originalStdin = process.stdin;

    function mockStdinAnswer(answer: string) {
      const readable = new Readable({ read() {} });
      Object.defineProperty(process, "stdin", {
        value: readable,
        writable: true,
        configurable: true,
      });
      // Push the answer after a microtask so readline has time to attach its listener.
      // The null signals EOF to the stream, causing readline to process the answer.
      queueMicrotask(() => {
        for (const chunk of [`${answer}\n`, null]) readable.push(chunk);
      });
    }

    afterEach(() => {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        writable: true,
        configurable: true,
      });
    });

    it("should cancel deletion when user responds no to confirmation", async () => {
      mockStdinAnswer("n");

      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId],
        import.meta.url,
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

    it("should proceed with deletion when user confirms", async () => {
      mockStdinAnswer("yes");

      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nockControl()
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [
          {
            ...createMockQueue(appId, mockQueueId),
            messages: { ready: 0, total: 0, unacknowledged: 0 },
          },
        ]);

      nockControl()
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId],
        import.meta.url,
      );

      expect(stdout).toContain("Queue deleted:");
    });
  });

  standardHelpTests("queues:delete", import.meta.url);
  standardArgValidationTests("queues:delete", import.meta.url, {
    requiredArgs: ["test-queue-id"],
  });
  standardFlagTests("queues:delete", import.meta.url, ["--json"]);
});
