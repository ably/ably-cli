import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("channels:annotations:subscribe command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
  });

  it("should subscribe to annotation events on a channel", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Make subscribe resolve immediately, then simulate a short duration
    const { stdout } = await runCommand(
      ["channels:annotations:subscribe", "test-channel", "--duration", "1"],
      import.meta.url,
    );

    expect(channel.annotations.subscribe).toHaveBeenCalledOnce();
    expect(stdout).toContain("Subscribed to annotations on channel");
    expect(stdout).toContain("test-channel");
  });

  it("should set ANNOTATION_SUBSCRIBE channel mode", async () => {
    const mock = getMockAblyRealtime();

    await runCommand(
      ["channels:annotations:subscribe", "test-channel", "--duration", "1"],
      import.meta.url,
    );

    // Verify channels.get was called with the correct mode
    expect(mock.channels.get).toHaveBeenCalledWith("test-channel", {
      modes: ["ANNOTATION_SUBSCRIBE"],
    });
  });

  it("should auto-unsubscribe on cleanup", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    await runCommand(
      ["channels:annotations:subscribe", "test-channel", "--duration", "1"],
      import.meta.url,
    );

    // After duration expires, unsubscribe should be called
    expect(channel.annotations.unsubscribe).toHaveBeenCalled();
  });

  it("should handle API errors", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.subscribe.mockImplementation(() => {
      throw new Error("Subscribe failed");
    });

    const { error } = await runCommand(
      ["channels:annotations:subscribe", "test-channel", "--duration", "1"],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/subscribe.*fail|error/i);
  });
});
