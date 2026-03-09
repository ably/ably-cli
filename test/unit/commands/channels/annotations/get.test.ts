import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("ChannelsAnnotationsGet", function () {
  beforeEach(function () {
    getMockAblyRest();
  });

  it("should get annotations with default limit", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [],
      hasNext: () => false,
      isLast: () => true,
    });

    const { stdout } = await runCommand(
      ["channels:annotations:get", "test-channel", "msg-serial-123"],
      import.meta.url,
    );

    expect(restMock.channels.get).toHaveBeenCalledWith("test-channel");
    expect(channel.annotations.get).toHaveBeenCalledOnce();
    expect(channel.annotations.get.mock.calls[0][0]).toBe("msg-serial-123");
    expect(channel.annotations.get.mock.calls[0][1]).toEqual({ limit: 100 });
    expect(stdout).toContain("No annotations found");
  });

  it("should get annotations with custom limit", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");
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

    expect(channel.annotations.get.mock.calls[0][1]).toEqual({ limit: 50 });
  });

  it("should display multiple annotations", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [
        {
          id: "ann-001",
          action: "annotation.create",
          type: "reactions:flag.v1",
          name: null,
          clientId: "user-123",
          count: undefined,
          data: null,
          messageSerial: "msg-serial-123",
          serial: "ann-serial-001",
          timestamp: 1741165200000,
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
          timestamp: 1741165201000,
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

  it("should output JSON when requested", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");
    channel.annotations.get.mockResolvedValue({
      items: [
        {
          id: "ann-001",
          action: "annotation.create",
          type: "reactions:flag.v1",
          name: null,
          clientId: "user-123",
          count: undefined,
          data: null,
          messageSerial: "msg-serial-123",
          serial: "ann-serial-001",
          timestamp: 1741165200000,
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
    expect(jsonOutput[0]).toHaveProperty("action", "annotation.create");
    expect(jsonOutput[0]).toHaveProperty("type", "reactions:flag.v1");
    expect(jsonOutput[0]).toHaveProperty("timestamp", 1741165200000);
  });

  it("should handle API errors", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");
    channel.annotations.get.mockRejectedValue(new Error("API Error"));

    const { error } = await runCommand(
      ["channels:annotations:get", "test-channel", "msg-serial-123"],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/API Error/i);
  });

  it("should show limit warning when results may be truncated", async function () {
    const restMock = getMockAblyRest();
    const channel = restMock.channels._getChannel("test-channel");

    // Create 10 mock annotations
    const mockAnnotations = Array.from({ length: 10 }, (_, i) => ({
      id: `ann-${i}`,
      action: "annotation.create",
      type: "reactions:flag.v1",
      name: null,
      clientId: `user-${i}`,
      count: undefined,
      data: null,
      messageSerial: "msg-serial-123",
      serial: `ann-serial-${i}`,
      timestamp: 1741165200000 + i,
    }));

    channel.annotations.get.mockResolvedValue({
      items: mockAnnotations,
      hasNext: () => false,
      isLast: () => true,
    });

    const { stdout } = await runCommand(
      [
        "channels:annotations:get",
        "test-channel",
        "msg-serial-123",
        "--limit",
        "10",
      ],
      import.meta.url,
    );

    // Should show limit warning when count equals limit
    expect(stdout).toContain("10");
  });
});
