import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("ConnectionsStats", function () {
  beforeEach(function () {
    const mock = getMockAblyRest();

    // Set up default mock response for stats
    mock.stats.mockResolvedValue({
      items: [
        {
          intervalId: Date.now().toString(),
          entries: {
            "connections.all.peak": 10,
            "connections.all.min": 5,
            "connections.all.mean": 7.5,
            "connections.all.opened": 15,
            "connections.all.refused": 2,
            "connections.all.count": 8,
            "channels.peak": 25,
            "channels.min": 10,
            "channels.mean": 18,
            "channels.opened": 30,
            "channels.refused": 1,
            "channels.count": 20,
            "messages.inbound.all.messages.count": 100,
            "messages.outbound.all.messages.count": 90,
            "messages.all.all.count": 190,
            "messages.all.all.data": 5000,
            "apiRequests.all.succeeded": 50,
            "apiRequests.all.failed": 3,
            "apiRequests.all.refused": 1,
            "apiRequests.tokenRequests.succeeded": 10,
            "apiRequests.tokenRequests.failed": 0,
            "apiRequests.tokenRequests.refused": 0,
          },
        },
      ],
    });
  });

  it("should retrieve and display connection stats successfully", async function () {
    const mock = getMockAblyRest();

    const { stdout } = await runCommand(["connections:stats"], import.meta.url);

    expect(mock.stats).toHaveBeenCalledOnce();

    // Verify the stats method was called with correct parameters
    const callArgs = mock.stats.mock.calls[0][0];
    expect(callArgs).toHaveProperty("unit", "minute");
    expect(callArgs).toHaveProperty("limit", 10);
    expect(callArgs).toHaveProperty("direction", "backwards");

    // Check that stats were displayed
    expect(stdout).toContain("Connections:");
    expect(stdout).toContain("Channels:");
    expect(stdout).toContain("Messages:");
  });

  it("should handle different time units", async function () {
    const mock = getMockAblyRest();

    await runCommand(
      ["connections:stats", "--unit", "hour", "--limit", "24"],
      import.meta.url,
    );

    expect(mock.stats).toHaveBeenCalledOnce();

    const callArgs = mock.stats.mock.calls[0][0];
    expect(callArgs).toHaveProperty("unit", "hour");
    expect(callArgs).toHaveProperty("limit", 24);
  });

  it("should handle custom time range with start and end", async function () {
    const mock = getMockAblyRest();
    const startTime = 1618005600000;
    const endTime = 1618091999999;

    await runCommand(
      [
        "connections:stats",
        "--start",
        startTime.toString(),
        "--end",
        endTime.toString(),
      ],
      import.meta.url,
    );

    expect(mock.stats).toHaveBeenCalledOnce();

    const callArgs = mock.stats.mock.calls[0][0];
    expect(callArgs).toHaveProperty("start", startTime);
    expect(callArgs).toHaveProperty("end", endTime);
  });

  it("should handle empty stats response", async function () {
    const mock = getMockAblyRest();
    mock.stats.mockResolvedValue({ items: [] });

    const { stdout } = await runCommand(["connections:stats"], import.meta.url);

    expect(mock.stats).toHaveBeenCalledOnce();
    expect(stdout).toContain("No connection stats available");
  });

  it("should handle API errors", async function () {
    const mock = getMockAblyRest();
    mock.stats.mockRejectedValue(new Error("API request failed"));

    const { error } = await runCommand(["connections:stats"], import.meta.url);

    expect(error).toBeDefined();
    expect(error?.message).toContain("Failed to fetch stats");
  });

  it("should output JSON when requested", async function () {
    const mock = getMockAblyRest();

    const { stdout } = await runCommand(
      ["connections:stats", "--json"],
      import.meta.url,
    );

    expect(mock.stats).toHaveBeenCalledOnce();

    // Check for JSON output - should contain entries
    const jsonOutput = stdout.split("\n").find((line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed.entries && typeof parsed.entries === "object";
      } catch {
        return false;
      }
    });
    expect(jsonOutput).toBeDefined();
  });

  // Note: Live mode tests are omitted because the command runs indefinitely
  // and is difficult to test reliably with runCommand. The live mode functionality
  // is tested manually or through integration tests.
});
