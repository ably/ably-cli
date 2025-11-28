import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";

describe("Channels publish ordering integration tests", function () {
  let originalEnv: NodeJS.ProcessEnv;
  let publishedMessages: Array<{ data: string; timestamp: number }>;
  let realtimeConnectionUsed: boolean;

  beforeEach(function () {
    // Store original env vars
    originalEnv = { ...process.env };
    publishedMessages = [];
    realtimeConnectionUsed = false;

    // Create a function that tracks published messages with timestamps
    const realtimePublishFunction = async (message: any) => {
      realtimeConnectionUsed = true;
      publishedMessages.push({
        data: message.data,
        timestamp: Date.now(),
      });
      // Simulate some network latency
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      return;
    };

    const restPublishFunction = async (message: any) => {
      publishedMessages.push({
        data: message.data,
        timestamp: Date.now(),
      });
      // Simulate some network latency
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      return;
    };

    // Create mock Ably clients
    const mockRealtimeClient = {
      channels: {
        get: () => ({
          publish: realtimePublishFunction,
          on: () => {},
        }),
      },
      connection: {
        once: (event: string, callback: () => void) => {
          realtimeConnectionUsed = true;
          if (event === "connected") {
            setTimeout(callback, 0);
          }
        },
        on: () => {},
        state: "connected",
      },
      close: () => {},
    };

    const mockRestClient = {
      channels: {
        get: () => ({
          publish: restPublishFunction,
          on: () => {},
        }),
      },
    };

    // Make the mocks globally available
    globalThis.__TEST_MOCKS__ = {
      ablyRealtimeMock: mockRealtimeClient,
      ablyRestMock: mockRestClient,
    };

    process.env.ABLY_TEST_MODE = "true";
    process.env.ABLY_SUPPRESS_PROCESS_EXIT = "true";
    process.env.ABLY_KEY = "test_key";
  });

  afterEach(function () {
    process.env = originalEnv;
    delete globalThis.__TEST_MOCKS__;
  });

  describe("Multiple message publishing", function () {
    it("should use realtime transport by default when publishing multiple messages", async function () {
      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "3",
        ],
        import.meta.url,
      );
      expect(stdout).toContain("3/3 messages published successfully");
      // Should have used realtime connection
      expect(realtimeConnectionUsed).toBe(true);
    });

    it("should respect explicit rest transport flag", async function () {
      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "3",
          "--transport",
          "rest",
        ],
        import.meta.url,
      );
      expect(stdout).toContain("3/3 messages published successfully");
      // Should not have used realtime connection
      expect(realtimeConnectionUsed).toBe(false);
    });

    it("should use rest transport for single message by default", async function () {
      const { stdout } = await runCommand(
        ["channels:publish", "test-channel", '"Single message"'],
        import.meta.url,
      );
      expect(stdout).toContain("Message published successfully");
      // Should not have used realtime connection
      expect(realtimeConnectionUsed).toBe(false);
    });
  });

  describe("Message delay and ordering", function () {
    it("should have 40ms default delay between messages", async function () {
      const startTime = Date.now();
      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "3",
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Publishing 3 messages with 40ms delay");
      expect(stdout).toContain("3/3 messages published successfully");

      // Check that messages were published with appropriate delays
      expect(publishedMessages).toHaveLength(3);

      // Check message order
      expect(publishedMessages[0].data).toBe("Message 1");
      expect(publishedMessages[1].data).toBe("Message 2");
      expect(publishedMessages[2].data).toBe("Message 3");

      // Check timing - should take at least 80ms (2 delays of 40ms)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(80);
    });

    it("should respect custom delay value", async function () {
      const startTime = Date.now();
      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "3",
          "--delay",
          "100",
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Publishing 3 messages with 100ms delay");
      expect(stdout).toContain("3/3 messages published successfully");

      // Check timing - should take at least 200ms (2 delays of 100ms)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(200);
    });

    it("should allow zero delay when explicitly set", async function () {
      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "3",
          "--delay",
          "0",
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Publishing 3 messages with 0ms delay");
      expect(stdout).toContain("3/3 messages published successfully");
    });

    it("should publish messages in sequential order with delay", async function () {
      await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "5",
        ],
        import.meta.url,
      );
      expect(publishedMessages).toHaveLength(5);

      // Verify messages are in correct order
      for (let i = 0; i < 5; i++) {
        expect(publishedMessages[i].data).toBe(`Message ${i + 1}`);
      }

      // Verify timestamps are sequential (each should be at least 40ms apart)
      for (let i = 1; i < publishedMessages.length; i++) {
        const timeDiff =
          publishedMessages[i].timestamp - publishedMessages[i - 1].timestamp;
        expect(timeDiff).toBeGreaterThanOrEqual(35); // Allow some margin for timer precision
      }
    });
  });

  describe("Error handling with multiple messages", function () {
    it("should continue publishing remaining messages on error", async function () {
      // Override the publish function to make the 3rd message fail
      let callCount = 0;
      const failingPublishFunction = async (message: any) => {
        callCount++;
        if (callCount === 3) {
          throw new Error("Network error");
        }
        publishedMessages.push({
          data: message.data,
          timestamp: Date.now(),
        });
        return;
      };

      // Update both mocks to use the failing function
      if (globalThis.__TEST_MOCKS__) {
        globalThis.__TEST_MOCKS__.ablyRealtimeMock.channels.get = () => ({
          publish: failingPublishFunction,
          on: () => {},
        });
        globalThis.__TEST_MOCKS__.ablyRestMock.channels.get = () => ({
          publish: failingPublishFunction,
          on: () => {},
        });
      }

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '"Message {{.Count}}"',
          "--count",
          "5",
        ],
        import.meta.url,
      );
      expect(stdout).toContain(
        "4/5 messages published successfully (1 errors)",
      );
      expect(publishedMessages).toHaveLength(4);
    });
  });
});
