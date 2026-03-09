import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("ChannelsAnnotationsDelete", function () {
  beforeEach(function () {
    getMockAblyRealtime();
  });

  it("should delete annotation with flag.v1 type successfully", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
      ],
      import.meta.url,
    );

    expect(realtimeMock.channels.get).toHaveBeenCalledWith("test-channel");
    expect(channel.annotations.delete).toHaveBeenCalledOnce();
    expect(channel.annotations.delete.mock.calls[0][0]).toBe("msg-serial-123");
    expect(channel.annotations.delete.mock.calls[0][1]).toEqual({
      type: "reactions:flag.v1",
    });
    expect(stdout).toContain("Annotation deleted from channel");
  });

  it("should delete annotation with distinct.v1 type and name", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "reactions:distinct.v1",
        "--name",
        "thumbsup",
      ],
      import.meta.url,
    );

    expect(channel.annotations.delete).toHaveBeenCalledOnce();
    expect(channel.annotations.delete.mock.calls[0][1]).toEqual({
      type: "reactions:distinct.v1",
      name: "thumbsup",
    });
    expect(stdout).toContain("Annotation deleted from channel");
  });

  it("should fail when --name is missing for unique.v1 type", async function () {
    const { error } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "emoji:unique.v1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain(
      '--name is required for "unique" annotation types',
    );
  });

  it("should not require --count for multiple.v1 type on delete", async function () {
    const realtimeMock = getMockAblyRealtime();
    const channel = realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "votes:multiple.v1",
        "--name",
        "thumbsup",
      ],
      import.meta.url,
    );

    expect(channel.annotations.delete).toHaveBeenCalledOnce();
    expect(channel.annotations.delete.mock.calls[0][1]).toEqual({
      type: "votes:multiple.v1",
      name: "thumbsup",
    });
    expect(stdout).toContain("Annotation deleted from channel");
  });

  it("should output JSON when requested", async function () {
    const realtimeMock = getMockAblyRealtime();
    realtimeMock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:delete",
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
    channel.annotations.delete.mockRejectedValue(new Error("API Error"));

    const { error } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/API Error/i);
  });
});
