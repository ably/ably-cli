import { describe, it, expect, afterEach } from "vitest";
import nock from "nock";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("queues:delete command", () => {
  const mockQueueName = "test-queue";

  afterEach(() => {
    nock.cleanAll();
  });

  function createMockQueue(appId: string, queueId: string) {
    return {
      id: queueId,
      appId,
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
  }

  describe("successful queue deletion", () => {
    it("should delete a queue successfully with --force flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Queue "test-queue" (ID: ${mockQueueId}) deleted successfully`,
      );
    });

    it("should delete a queue with custom app ID", async () => {
      const accountId = getMockConfigManager().getCurrentAccount()!.accountId!;
      const customAppId = "custom-app-id";
      const mockQueueId = `${customAppId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: customAppId, accountId, name: "Test App" }]);

      nock("https://control.ably.net")
        .get(`/v1/apps/${customAppId}/queues`)
        .reply(200, [createMockQueue(customAppId, mockQueueId)]);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${customAppId}/queues/${mockQueueId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["queues:delete", mockQueueId, "--app", "custom-app-id", "--force"],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Queue "test-queue" (ID: ${mockQueueId}) deleted successfully`,
      );
    });

    it("should use custom access token when provided", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;
      const customToken = "custom_access_token";

      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
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

      expect(error).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
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

      nock("https://control.ably.net")
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

    it("should handle 500 server error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["queues:delete", mockQueueId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Queue.*not found|500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle queue not found error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

      nock("https://control.ably.net")
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
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
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

      nock("https://control.ably.net")
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

      nock("https://control.ably.net")
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
    it.skip("should cancel deletion when user responds no to confirmation", async () => {
      // SKIPPED: stdin handling in tests is problematic with runCommand
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [createMockQueue(appId, mockQueueId)]);

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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockQueueId = `${appId}:us-east-1-a:${mockQueueName}`;

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/queues`)
        .reply(200, [
          {
            ...createMockQueue(appId, mockQueueId),
            messages: { ready: 0, total: 0, unacknowledged: 0 },
          },
        ]);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/queues/${mockQueueId}`)
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
