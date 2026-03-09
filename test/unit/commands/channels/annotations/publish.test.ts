import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("ChannelsAnnotationsPublish", function () {
  beforeEach(function () {
    getMockAblyRealtime();
  });

  it("should publish annotation with total.v1 type successfully", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:total.v1",
      ],
      import.meta.url,
    );

    expect(realtimeMock.channels.get).toHaveBeenCalledWith("test-channel");
    expect(channel.annotations.publish).toHaveBeenCalledOnce();
    expect(channel.annotations.publish.mock.calls[0][0]).toBe("msg-serial-123");
    expect(channel.annotations.publish.mock.calls[0][1]).toEqual({
      type: "reactions:total.v1",
    });
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should publish annotation with flag.v1 type successfully", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledOnce();
    expect(channel.annotations.publish.mock.calls[0][1]).toEqual({
      type: "reactions:flag.v1",
    });
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should publish annotation with distinct.v1 type and name", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:distinct.v1",
        "--name",
        "thumbsup",
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledOnce();
    expect(channel.annotations.publish.mock.calls[0][1]).toEqual({
      type: "reactions:distinct.v1",
      name: "thumbsup",
    });
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should publish annotation with unique.v1 type and name", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "emoji:unique.v1",
        "--name",
        "option1",
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledOnce();
    expect(channel.annotations.publish.mock.calls[0][1]).toEqual({
      type: "emoji:unique.v1",
      name: "option1",
    });
  });

  it("should publish annotation with multiple.v1 type, name, and count", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "votes:multiple.v1",
        "--name",
        "thumbsup",
        "--count",
        "3",
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledOnce();
    expect(channel.annotations.publish.mock.calls[0][1]).toEqual({
      type: "votes:multiple.v1",
      name: "thumbsup",
      count: 3,
    });
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should fail when --name is missing for distinct.v1 type", async function () {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:distinct.v1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain(
      '--name is required for "distinct" annotation types',
    );
  });

  it("should fail when --count is missing for multiple.v1 type", async function () {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "votes:multiple.v1",
        "--name",
        "thumbsup",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain(
      '--count is required for "multiple" annotation types',
    );
  });

  it("should fail with invalid annotation type format (missing colon)", async function () {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactionsflag.v1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain("Invalid annotation type format");
  });

  it("should fail with invalid annotation type format (missing dot)", async function () {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flagv1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain("Invalid annotation type format");
  });

  it("should output JSON when requested", async function () {
    const realtimeMock = getMockAblyRealtime();
    realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
        "--json",
      ],
      import.meta.url,
    );

    const jsonOutput = JSON.parse(stdout.trim());
    expect(jsonOutput).toHaveProperty("success", true);
    expect(jsonOutput).toHaveProperty("channel", "test-channel");
    expect(jsonOutput).toHaveProperty("messageSerial", "msg-serial-123");
    expect(jsonOutput).toHaveProperty("annotationType", "reactions:flag.v1");
  });

  it("should handle API errors", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");
    channel.annotations.publish.mockRejectedValue(new Error("API Error"));

    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/API Error/i);
  });

  it("should publish annotation with --data flag", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
        "--data",
        '{"emoji":"👍"}',
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledOnce();
    expect(channel.annotations.publish.mock.calls[0][1]).toEqual({
      type: "reactions:flag.v1",
      data: { emoji: "👍" },
    });
  });

  it("should fail with invalid --data JSON", async function () {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
        "--data",
        "not-valid-json",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/invalid|json|parse/i);
  });
});
