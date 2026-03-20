import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("ChannelsPublish", function () {
  beforeEach(function () {
    // Initialize both mocks
    getMockAblyRealtime();
    getMockAblyRest();
  });

  standardHelpTests("channels:publish", import.meta.url);
  standardArgValidationTests("channels:publish", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:publish", import.meta.url, [
    "--json",
    "--transport",
    "--token-streaming",
    "--stream-duration",
    "--token-size",
  ]);

  describe("functionality", function () {
    it("should publish a message using REST successfully", async function () {
      const restMock = getMockAblyRest();
      const channel = restMock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"hello"}',
          "--transport",
          "rest",
        ],
        import.meta.url,
      );

      expect(restMock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.publish).toHaveBeenCalledOnce();
      expect(channel.publish.mock.calls[0][0]).toEqual({ data: "hello" });
      expect(stdout).toContain("Message published to channel");
    });

    it("should publish a message using Realtime successfully", async function () {
      const realtimeMock = getMockAblyRealtime();
      const channel = realtimeMock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"realtime hello"}',
          "--transport",
          "realtime",
        ],
        import.meta.url,
      );

      expect(realtimeMock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.publish).toHaveBeenCalledOnce();
      expect(channel.publish.mock.calls[0][0]).toEqual({
        data: "realtime hello",
      });
      expect(stdout).toContain("Message published to channel");
    });

    it("should publish with specified event name", async function () {
      const restMock = getMockAblyRest();
      const channel = restMock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"hello"}',
          "--transport",
          "rest",
          "--name",
          "custom-event",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledOnce();
      const publishArgs = channel.publish.mock.calls[0][0];
      expect(publishArgs).toHaveProperty("name", "custom-event");
      expect(publishArgs).toHaveProperty("data", "hello");
    });

    it("should publish multiple messages with --count", async function () {
      const restMock = getMockAblyRest();
      const channel = restMock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"count test"}',
          "--transport",
          "rest",
          "--count",
          "3",
          "--delay",
          "0",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledTimes(3);
      expect(stdout).toContain("messages published to channel");
    });

    it("should output JSON when requested", async function () {
      const restMock = getMockAblyRest();
      restMock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"hello"}',
          "--transport",
          "rest",
          "--json",
        ],
        import.meta.url,
      );

      // Parse the JSON output
      const jsonOutput = JSON.parse(stdout.trim());
      expect(jsonOutput).toHaveProperty("type", "result");
      expect(jsonOutput).toHaveProperty("command", "channels:publish");
      expect(jsonOutput).toHaveProperty("success", true);
      expect(jsonOutput).toHaveProperty("publish.channel", "test-channel");
    });

    it("should handle plain text messages", async function () {
      const restMock = getMockAblyRest();
      const channel = restMock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:publish",
          "test-channel",
          "HelloWorld",
          "--transport",
          "rest",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalledOnce();
      // Plain text should be wrapped in data field
      const publishArgs = channel.publish.mock.calls[0][0];
      expect(publishArgs).toHaveProperty("data", "HelloWorld");
    });

    it("should use realtime transport by default when publishing multiple messages", async function () {
      const realtimeMock = getMockAblyRealtime();
      const restMock = getMockAblyRest();
      const realtimeChannel = realtimeMock.channels._getChannel("test-channel");
      const restChannel = restMock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"Message {{.Count}}"}',
          "--count",
          "3",
          "--delay",
          "0",
        ],
        import.meta.url,
      );

      // With count > 1 and no explicit transport, should use realtime
      expect(realtimeChannel.publish).toHaveBeenCalledTimes(3);
      expect(restChannel.publish).not.toHaveBeenCalled();
    });

    it("should respect explicit rest transport flag for multiple messages", async function () {
      const realtimeMock = getMockAblyRealtime();
      const restMock = getMockAblyRest();
      const realtimeChannel = realtimeMock.channels._getChannel("test-channel");
      const restChannel = restMock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"Message {{.Count}}"}',
          "--transport",
          "rest",
          "--count",
          "3",
          "--delay",
          "0",
        ],
        import.meta.url,
      );

      expect(restChannel.publish).toHaveBeenCalledTimes(3);
      expect(realtimeChannel.publish).not.toHaveBeenCalled();
    });

    it("should handle null serial from publish result (conflation)", async function () {
      const restMock = getMockAblyRest();
      const channel = restMock.channels._getChannel("test-channel");
      channel.publish.mockResolvedValue({ serials: [null] });

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"hello"}',
          "--transport",
          "rest",
        ],
        import.meta.url,
      );

      // Should NOT display "null" as a serial
      expect(stdout).not.toContain("Serial:");
    });

    it("should use rest transport for single message by default", async function () {
      const realtimeMock = getMockAblyRealtime();
      const restMock = getMockAblyRest();
      const realtimeChannel = realtimeMock.channels._getChannel("test-channel");
      const restChannel = restMock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:publish", "test-channel", '{"data":"Single message"}'],
        import.meta.url,
      );

      expect(restChannel.publish).toHaveBeenCalledOnce();
      expect(realtimeChannel.publish).not.toHaveBeenCalled();
    });

    it("should include serial in per-message output for multi-message publish", async function () {
      const restMock = getMockAblyRest();
      restMock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"count test"}',
          "--transport",
          "rest",
          "--count",
          "2",
          "--delay",
          "0",
        ],
        import.meta.url,
      );

      // Each message should show its serial
      expect(stdout).toContain("mock-serial-001");
    });

    describe("message delay and ordering", function () {
      it("should publish messages with delay", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const startTime = Date.now();
        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"Message {{.Count}}"}',
            "--transport",
            "realtime",
            "--count",
            "3",
            "--delay",
            "40",
          ],
          import.meta.url,
        );
        const totalTime = Date.now() - startTime;

        expect(channel.publish).toHaveBeenCalledTimes(3);
        // Should take at least 80ms (2 delays of 40ms between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(80);
      });

      it("should respect custom delay value", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const startTime = Date.now();
        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"Message {{.Count}}"}',
            "--transport",
            "realtime",
            "--count",
            "3",
            "--delay",
            "100",
          ],
          import.meta.url,
        );
        const totalTime = Date.now() - startTime;

        expect(channel.publish).toHaveBeenCalledTimes(3);
        // Should take at least 200ms (2 delays of 100ms between 3 messages)
        expect(totalTime).toBeGreaterThanOrEqual(200);
      });

      it("should allow zero delay when explicitly set", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const startTime = Date.now();
        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"Message {{.Count}}"}',
            "--transport",
            "realtime",
            "--count",
            "3",
            "--delay",
            "0",
          ],
          import.meta.url,
        );
        const totalTime = Date.now() - startTime;

        expect(channel.publish).toHaveBeenCalledTimes(3);
        // With zero delay, should complete quickly (under 100ms accounting for overhead)
        expect(totalTime).toBeLessThan(100);
      });

      it("should publish messages in sequential order", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const publishedData: string[] = [];
        channel.publish.mockImplementation(
          async (message: { data?: string }) => {
            publishedData.push(message.data ?? "");
          },
        );

        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"Message {{.Count}}"}',
            "--transport",
            "realtime",
            "--count",
            "5",
            "--delay",
            "0",
          ],
          import.meta.url,
        );

        expect(publishedData).toEqual([
          "Message 1",
          "Message 2",
          "Message 3",
          "Message 4",
          "Message 5",
        ]);
      });
    });

    describe("token streaming mode", function () {
      it("should publish text as streamed token appends with --token-streaming", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const { stdout } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorldTestData",
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "6",
          ],
          import.meta.url,
        );

        // Should have published initial message
        expect(channel.publish).toHaveBeenCalledOnce();
        // Should have appended remaining tokens
        expect(channel.appendMessage).toHaveBeenCalled();
        expect(stdout).toContain("Streamed");
        expect(stdout).toContain("tokens");
      });

      it("should support --token-streaming with --count > 1", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const { error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorldTestData",
            "--token-streaming",
            "--count",
            "2",
            "--stream-duration",
            "1",
            "--token-size",
            "6",
            "--delay",
            "0",
          ],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        expect(channel.publish).toHaveBeenCalledTimes(2);
        expect(channel.appendMessage).toHaveBeenCalled();
      });

      it("should show stream progress in human-readable output", async function () {
        getMockAblyRealtime();

        const { stdout } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "StreamingDemoTextHere",
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "5",
          ],
          import.meta.url,
        );

        expect(stdout).toContain("Streaming");
        expect(stdout).toContain("tokens");
        expect(stdout).toContain("Initial token published");
      });

      it("should stream text with spaces when passed as JSON data", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const { stdout } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"The quick brown fox jumps over"}',
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "6",
          ],
          import.meta.url,
        );

        // Should have published initial message
        expect(channel.publish).toHaveBeenCalledOnce();
        // Text has spaces so should produce multiple tokens
        expect(channel.appendMessage).toHaveBeenCalled();
        expect(stdout).toContain("Streamed");
        expect(stdout).toContain("tokens");

        // Verify the initial publish contains part of the text
        const publishArgs = channel.publish.mock.calls[0][0];
        expect(publishArgs.data).toBeTruthy();

        // Verify appended tokens are part of the original text
        const appendedChunks = channel.appendMessage.mock.calls.map(
          (call: unknown[]) => (call[0] as { data: string }).data,
        );
        const allText = publishArgs.data + appendedChunks.join("");
        expect(allText).toBe("The quick brown fox jumps over");
      });

      it("should work with --token-streaming and explicit --count 1", async function () {
        getMockAblyRealtime();

        const { stdout, error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorldTest",
            "--token-streaming",
            "--count",
            "1",
            "--stream-duration",
            "1",
            "--token-size",
            "5",
          ],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        expect(stdout).toContain("Streamed");
        expect(stdout).toContain("tokens");
      });

      it("should recover with updateMessage when appendMessage fails mid-stream", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        let appendCallCount = 0;
        channel.appendMessage.mockImplementation(async () => {
          appendCallCount++;
          if (appendCallCount >= 2) {
            throw new Error("Network timeout");
          }
          return { versionSerial: "mock-version" };
        });

        const { error, stderr } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"The quick brown fox jumps over"}',
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "4",
          ],
          import.meta.url,
        );

        expect(error).toBeUndefined();
        expect(channel.updateMessage).toHaveBeenCalledOnce();
        const updateCall = channel.updateMessage.mock.calls[0][0];
        expect(updateCall.serial).toBe("mock-serial-001");
        expect(updateCall.data).toBe("The quick brown fox jumps over");
        expect(stderr).toContain(
          "failed. Recovered by publishing full message via updateMessage",
        );
      });

      it("should emit JSON recovery event when appendMessage fails mid-stream with --json", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        let appendCallCount = 0;
        channel.appendMessage.mockImplementation(async () => {
          appendCallCount++;
          if (appendCallCount >= 2) {
            throw new Error("Network timeout");
          }
          return { versionSerial: "mock-version" };
        });

        const { stdout, error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"The quick brown fox jumps over"}',
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "4",
            "--json",
          ],
          import.meta.url,
        );

        expect(error).toBeUndefined();

        const lines = stdout
          .trim()
          .split("\n")
          .filter((l: string) => l.trim());
        const records = lines.map((l: string) => JSON.parse(l));

        const recoveryEvents = records.filter(
          (r: Record<string, unknown>) =>
            r.type === "event" &&
            (r as Record<string, Record<string, unknown>>).message?.action ===
              "message.recovery",
        );

        expect(recoveryEvents.length).toBe(1);
        const recovery = recoveryEvents[0] as Record<
          string,
          Record<string, unknown>
        >;
        expect(recovery.message).toHaveProperty("serial", "mock-serial-001");
        expect(recovery.message).toHaveProperty(
          "data",
          "The quick brown fox jumps over",
        );
        expect(recovery.message).toHaveProperty("failedAppends");
        expect(recovery.message).toHaveProperty("totalTokens");
        expect(recovery.message).toHaveProperty("timestamp");
      });

      it("should fail when both appendMessage and updateMessage fail", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        channel.appendMessage.mockRejectedValue(new Error("Network timeout"));
        channel.updateMessage.mockRejectedValue(
          new Error("Update also failed"),
        );

        const { error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"The quick brown fox jumps over"}',
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "4",
          ],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toContain("Update also failed");
      });

      it("should take longer with a higher --stream-duration value", async function () {
        getMockAblyRealtime();

        const startTime = Date.now();
        await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorldTestData",
            "--token-streaming",
            "--stream-duration",
            "2",
            "--token-size",
            "6",
          ],
          import.meta.url,
        );
        const elapsed = Date.now() - startTime;

        // With --stream-duration 2, should take at least ~1.5s (accounting for overhead)
        expect(elapsed).toBeGreaterThanOrEqual(1500);
      });

      it("should reject JSON object data in token streaming mode", async function () {
        getMockAblyRealtime();

        const { error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":{"nested":"object"}}',
            "--token-streaming",
            "--stream-duration",
            "1",
          ],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toContain("text data");
      });

      it("should forward encoding to initial publish in streaming mode", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"HelloWorldTestData"}',
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "6",
            "--encoding",
            "utf-8/cipher+aes-256-cbc",
          ],
          import.meta.url,
        );

        // Initial publish should include encoding
        const publishArgs = channel.publish.mock.calls[0][0];
        expect(publishArgs).toHaveProperty(
          "encoding",
          "utf-8/cipher+aes-256-cbc",
        );
      });

      it("should reject --token-streaming with --transport", async function () {
        getMockAblyRealtime();

        const { error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorld",
            "--token-streaming",
            "--transport",
            "rest",
          ],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toContain("cannot also be provided");
      });

      it("should reject empty string data in token streaming mode", async function () {
        getMockAblyRealtime();

        const { error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":""}',
            "--token-streaming",
            "--stream-duration",
            "1",
          ],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toContain("No text to stream");
      });

      it("should warn when text fits in a single token", async function () {
        getMockAblyRealtime();

        const { stderr } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "Hi",
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "10",
          ],
          import.meta.url,
        );

        expect(stderr).toContain("Text fits in a single token");
      });

      it("should fail when initial publish returns no serial in streaming mode", async function () {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");
        channel.publish.mockResolvedValue({ serials: [] });

        const { error } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorld",
            "--token-streaming",
            "--stream-duration",
            "1",
          ],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toContain("serial");
      });

      it("should output JSON events per token with --token-streaming --json", async function () {
        getMockAblyRealtime();

        const { stdout } = await runCommand(
          [
            "channels:publish",
            "test-channel",
            "HelloWorldText",
            "--token-streaming",
            "--stream-duration",
            "1",
            "--token-size",
            "5",
            "--json",
          ],
          import.meta.url,
        );

        // Parse NDJSON output
        const lines = stdout
          .trim()
          .split("\n")
          .filter((l: string) => l.trim());
        const records = lines.map((l: string) => JSON.parse(l));

        // Should have events for each token plus a final result
        const events = records.filter(
          (r: Record<string, unknown>) => r.type === "event",
        );
        const results = records.filter(
          (r: Record<string, unknown>) => r.type === "result",
        );

        expect(events.length).toBeGreaterThanOrEqual(1);
        // Verify JSON events include timestamp, clientId, and connectionId fields
        const firstEvent = events[0] as Record<string, Record<string, unknown>>;
        expect(firstEvent.message).toHaveProperty("timestamp");
        expect(firstEvent.message).toHaveProperty("tokenIndex");
        expect(firstEvent.message).toHaveProperty("totalTokens");
        expect(firstEvent.message).toHaveProperty("clientId", "mock-client-id");
        expect(firstEvent.message).toHaveProperty(
          "connectionId",
          "mock-connection-id",
        );
        expect(results.length).toBe(1);
        expect(results[0]).toHaveProperty("tokenStreams");
        expect(results[0].tokenStreams).toHaveLength(1);
        expect(results[0].tokenStreams[0]).toHaveProperty("totalTokens");
        expect(results[0].tokenStreams[0]).toHaveProperty("serial");
        expect(results[0]).toHaveProperty("channel", "test-channel");
        expect(results[0]).toHaveProperty("published");
        expect(results[0]).toHaveProperty("total");
        expect(results[0]).toHaveProperty("allSucceeded", true);
      });
    });

    describe("extras and push data", function () {
      it("should include extras.push when provided in message data", async function () {
        const restMock = getMockAblyRest();
        const channel = restMock.channels._getChannel("test-channel");

        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"data":"hello","extras":{"push":{"notification":{"title":"Test","body":"Push notification"}}}}',
            "--transport",
            "rest",
          ],
          import.meta.url,
        );

        expect(channel.publish).toHaveBeenCalledOnce();
        const publishArgs = channel.publish.mock.calls[0][0];
        expect(publishArgs).toHaveProperty("data", "hello");
        expect(publishArgs).toHaveProperty("extras");
        expect(publishArgs.extras).toHaveProperty("push");
        expect(publishArgs.extras.push).toEqual({
          notification: { title: "Test", body: "Push notification" },
        });
      });

      it("should publish a message when only extras is provided without data", async function () {
        const restMock = getMockAblyRest();
        const channel = restMock.channels._getChannel("test-channel");

        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"extras":{"push":{"notification":{"title":"Extras only","body":"No data field"}}}}',
            "--transport",
            "rest",
          ],
          import.meta.url,
        );

        expect(channel.publish).toHaveBeenCalledOnce();
        const publishArgs = channel.publish.mock.calls[0][0];
        expect(publishArgs).toHaveProperty("extras");
        expect(publishArgs.extras).toHaveProperty("push");
        expect(publishArgs.extras.push).toEqual({
          notification: { title: "Extras only", body: "No data field" },
        });
        expect(publishArgs).not.toHaveProperty("data");
      });

      it("should preserve name when extras is provided without data", async function () {
        const restMock = getMockAblyRest();
        const channel = restMock.channels._getChannel("test-channel");

        await runCommand(
          [
            "channels:publish",
            "test-channel",
            '{"name":"eventName","extras":{"push":{"notification":{"title":"With name","body":"No data field"}}}}',
            "--transport",
            "rest",
          ],
          import.meta.url,
        );

        expect(channel.publish).toHaveBeenCalledOnce();
        const publishArgs = channel.publish.mock.calls[0][0];
        expect(publishArgs).toHaveProperty("name", "eventName");
        expect(publishArgs).toHaveProperty("extras");
        expect(publishArgs.extras).toHaveProperty("push");
        expect(publishArgs.extras.push).toEqual({
          notification: { title: "With name", body: "No data field" },
        });
        expect(publishArgs).not.toHaveProperty("data");
      });
    });
  });

  describe("error handling", function () {
    it("should handle API errors during REST publish", async function () {
      const restMock = getMockAblyRest();
      const channel = restMock.channels._getChannel("test-channel");
      channel.publish.mockRejectedValue(new Error("REST API Error"));

      const { stdout, stderr } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"test"}',
          "--transport",
          "rest",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalled();
      // Error should be shown somewhere in output
      const output = stdout + stderr;
      expect(output).toMatch(/error|fail/i);
    });

    it("should handle API errors during Realtime publish", async function () {
      const realtimeMock = getMockAblyRealtime();
      const channel = realtimeMock.channels._getChannel("test-channel");
      channel.publish.mockRejectedValue(new Error("Realtime API Error"));

      const { stdout, stderr } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"test"}',
          "--transport",
          "realtime",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalled();
      // Error should be shown somewhere in output
      const output = stdout + stderr;
      expect(output).toMatch(/error|fail/i);
    });

    it("should continue publishing remaining messages on error", async function () {
      const realtimeMock = getMockAblyRealtime();
      const channel = realtimeMock.channels._getChannel("test-channel");

      let callCount = 0;
      const publishedData: string[] = [];

      channel.publish.mockImplementation(async (message: { data?: string }) => {
        callCount++;
        if (callCount === 3) {
          throw new Error("Network error");
        }
        publishedData.push(message.data ?? "");
      });

      const { stdout } = await runCommand(
        [
          "channels:publish",
          "test-channel",
          '{"data":"Message {{.Count}}"}',
          "--transport",
          "realtime",
          "--count",
          "5",
          "--delay",
          "0",
        ],
        import.meta.url,
      );

      // Should have attempted all 5, but only 4 succeeded
      expect(channel.publish).toHaveBeenCalledTimes(5);
      expect(publishedData).toHaveLength(4);
      expect(stdout).toContain("4/5");
      expect(stdout).toContain("1");
      expect(stdout).toMatch(/error/i);
    });
  });
});
