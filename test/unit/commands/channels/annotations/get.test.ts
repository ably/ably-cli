import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("channels:annotations:get command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  it("should get annotations with default limit", async () => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [],
      hasNext: () => false,
      isLast: () => true,
    });

    const { stdout } = await runCommand(
      ["channels:annotations:get", "test-channel", "msg-serial-123"],
      import.meta.url,
    );

    expect(channel.annotations.get).toHaveBeenCalledExactlyOnceWith(
      "msg-serial-123",
      { limit: 100 },
    );
    expect(stdout).toContain("No annotations found");
  });

  it("should get annotations with custom --limit", async () => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [],
      hasNext: () => false,
      isLast: () => true,
    });

    await runCommand(
      [
        "channels:annotations:get",
        "test-channel",
        "msg-serial-123",
        "--limit",
        "50",
      ],
      import.meta.url,
    );

    expect(channel.annotations.get).toHaveBeenCalledWith("msg-serial-123", {
      limit: 50,
    });
  });

  it("should display multiple annotations", async () => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [
        {
          id: "ann-001",
          action: "annotation.create",
          type: "reactions:flag.v1",
          name: undefined,
          clientId: "user-123",
          count: undefined,
          data: undefined,
          messageSerial: "msg-serial-123",
          serial: "ann-serial-001",
          timestamp: 1700000000000,
        },
        {
          id: "ann-002",
          action: "annotation.create",
          type: "reactions:distinct.v1",
          name: "thumbsup",
          clientId: "user-456",
          count: undefined,
          data: { emoji: "👍" },
          messageSerial: "msg-serial-123",
          serial: "ann-serial-002",
          timestamp: 1700000001000,
        },
      ],
      hasNext: () => false,
      isLast: () => true,
    });

    const { stdout } = await runCommand(
      ["channels:annotations:get", "test-channel", "msg-serial-123"],
      import.meta.url,
    );

    expect(stdout).toContain("Annotations for message");
    expect(stdout).toContain("reactions:flag.v1");
    expect(stdout).toContain("reactions:distinct.v1");
    expect(stdout).toContain("thumbsup");
    expect(stdout).toContain("user-123");
    expect(stdout).toContain("user-456");
  });

  it("should output JSON when --json flag is used", async () => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [
        {
          id: "ann-001",
          action: "annotation.create",
          type: "reactions:flag.v1",
          name: undefined,
          clientId: "user-123",
          count: undefined,
          data: undefined,
          messageSerial: "msg-serial-123",
          serial: "ann-serial-001",
          timestamp: 1700000000000,
        },
      ],
      hasNext: () => false,
      isLast: () => true,
    });

    const { stdout } = await runCommand(
      ["channels:annotations:get", "test-channel", "msg-serial-123", "--json"],
      import.meta.url,
    );

    const jsonOutput = JSON.parse(stdout.trim());
    expect(Array.isArray(jsonOutput)).toBe(true);
    expect(jsonOutput).toHaveLength(1);
    expect(jsonOutput[0]).toHaveProperty("id", "ann-001");
    expect(jsonOutput[0]).toHaveProperty("type", "reactions:flag.v1");
    expect(jsonOutput[0]).toHaveProperty("action", "annotation.create");
  });

  it("should handle API errors", async () => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.annotations.get.mockRejectedValue(new Error("API Error"));

    const { error } = await runCommand(
      ["channels:annotations:get", "test-channel", "msg-serial-123"],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/error.*retriev|api error/i);
  });
});
