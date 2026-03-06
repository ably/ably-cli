import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("channels:annotations:delete command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
  });

  it("should delete annotation with flag.v1 type", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "reactions:flag.v1",
      ],
      import.meta.url,
    );

    expect(channel.annotations.delete).toHaveBeenCalledExactlyOnceWith(
      "msg-serial-123",
      { type: "reactions:flag.v1" },
    );
    expect(stdout).toContain("Annotation deleted from channel");
  });

  it("should delete annotation with distinct.v1 type and --name", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

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

    expect(channel.annotations.delete).toHaveBeenCalledExactlyOnceWith(
      "msg-serial-123",
      { type: "reactions:distinct.v1", name: "thumbsup" },
    );
    expect(stdout).toContain("Annotation deleted from channel");
  });

  it("should fail validation when --name is missing for unique.v1", async () => {
    const { error } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "reactions:unique.v1",
      ],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/--name.*required/i);
  });

  it("should not require --count for delete on multiple.v1 type", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    const { stdout } = await runCommand(
      [
        "channels:annotations:delete",
        "test-channel",
        "msg-serial-123",
        "votes:multiple.v1",
        "--name",
        "option-a",
      ],
      import.meta.url,
    );

    expect(channel.annotations.delete).toHaveBeenCalledOnce();
    expect(stdout).toContain("Annotation deleted from channel");
  });

  it("should output JSON when --json flag is used", async () => {
    const mock = getMockAblyRealtime();
    mock.channels._getChannel("test-channel");

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

  it("should handle API errors during delete", async () => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.delete.mockRejectedValue(new Error("Delete failed"));

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
    expect(error?.message).toMatch(/error.*delet|delete.*fail/i);
  });
});
