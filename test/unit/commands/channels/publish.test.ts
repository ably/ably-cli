import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("ChannelsPublish", function () {
  beforeEach(function () {
    // Initialize both mocks
    getMockAblyRealtime();
    getMockAblyRest();
  });

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
    expect(stdout).toContain("Message published successfully");
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
    expect(stdout).toContain("Message published successfully");
  });

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
    expect(stdout).toContain("messages published successfully");
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
    expect(jsonOutput).toHaveProperty("success", true);
    expect(jsonOutput).toHaveProperty("channel", "test-channel");
  });

  it("should handle plain text messages", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");

    await runCommand(
      ["channels:publish", "test-channel", "HelloWorld", "--transport", "rest"],
      import.meta.url,
    );

    expect(channel.publish).toHaveBeenCalledOnce();
    // Plain text should be wrapped in data field
    const publishArgs = channel.publish.mock.calls[0][0];
    expect(publishArgs).toHaveProperty("data", "HelloWorld");
  });

  describe("transport selection", function () {
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
      channel.publish.mockImplementation(async (message: { data?: string }) => {
        publishedData.push(message.data ?? "");
      });

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

  describe("error handling with multiple messages", function () {
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
