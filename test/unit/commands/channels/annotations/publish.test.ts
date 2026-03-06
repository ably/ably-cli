import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("channels:annotations:publish command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
  });

  it("should publish annotation with flag.v1 type", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledExactlyOnceWith(
      "msg-serial-123",
      { type: "reactions:flag.v1" },
    );
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should publish annotation with distinct.v1 type and --name", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

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

    expect(channel.annotations.publish).toHaveBeenCalledExactlyOnceWith(
      "msg-serial-123",
      { type: "reactions:distinct.v1", name: "thumbsup" },
    );
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should publish annotation with multiple.v1 type and --name --count", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "votes:multiple.v1",
        "--name",
        "option-a",
        "--count",
        "5",
      ],
      import.meta.url,
    );

    expect(channel.annotations.publish).toHaveBeenCalledExactlyOnceWith(
      "msg-serial-123",
      { type: "votes:multiple.v1", name: "option-a", count: 5 },
    );
    expect(stdout).toContain("Annotation published to channel");
  });

  it("should fail validation when --name is missing for distinct.v1", async () => {
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
    expect(error?.message).toMatch(/--name.*required/i);
  });

  it("should fail validation when --count is missing for multiple.v1", async () => {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "votes:multiple.v1",
        "--name",
        "option-a",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/--count.*required/i);
  });

  it("should fail validation for invalid annotation type format", async () => {
    const { error } = await runCommand(
      [
        "channels:annotations:publish",
        "test-channel",
        "msg-serial-123",
        "invalidformat",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/invalid.*annotation.*type/i);
  });

  it("should output JSON when --json flag is used", async () => {
    const mock = getMockAblyRealtime();
    mock.channels._getChannel("test-channel");

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

  it("should include --data payload when provided", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

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

    expect(channel.annotations.publish).toHaveBeenCalledWith("msg-serial-123", {
      type: "reactions:flag.v1",
      data: { emoji: "👍" },
    });
  });

  it("should handle API errors during publish", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.publish.mockRejectedValue(new Error("Publish failed"));

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
    expect(error?.message).toMatch(/error.*publish|publish.*fail/i);
  });
});
