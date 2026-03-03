import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("ChannelsOccupancyGet", function () {
  beforeEach(function () {
    const mock = getMockAblyRest();
    // Set up default mock response for REST request
    mock.request.mockResolvedValue({
      items: [
        {
          status: {
            occupancy: {
              metrics: {
                connections: 10,
                presenceConnections: 5,
                presenceMembers: 8,
                presenceSubscribers: 4,
                publishers: 2,
                subscribers: 6,
              },
            },
          },
        },
      ],
    });
  });

  it("should successfully retrieve and display occupancy using REST API", async function () {
    const mock = getMockAblyRest();

    const { stdout } = await runCommand(
      ["channels:occupancy:get", "test-occupancy-channel"],
      import.meta.url,
    );

    // Check that request was called with the right parameters
    expect(mock.request).toHaveBeenCalledOnce();
    const [method, path, version, params, body] = mock.request.mock.calls[0];
    expect(method).toBe("get");
    expect(path).toBe("/channels/test-occupancy-channel");
    expect(version).toBe(2);
    expect(params).toEqual({ occupancy: "metrics" });
    expect(body).toBeNull();

    // Check for expected output
    expect(stdout).toContain("test-occupancy-channel");
    expect(stdout).toContain("Connections: 10");
    expect(stdout).toContain("Presence Connections: 5");
    expect(stdout).toContain("Presence Members: 8");
    expect(stdout).toContain("Presence Subscribers: 4");
    expect(stdout).toContain("Publishers: 2");
    expect(stdout).toContain("Subscribers: 6");
  });

  it("should output occupancy in JSON format when requested", async function () {
    const mock = getMockAblyRest();

    const { stdout } = await runCommand(
      ["channels:occupancy:get", "test-occupancy-channel", "--json"],
      import.meta.url,
    );

    expect(mock.request).toHaveBeenCalledOnce();

    // Parse and verify the JSON output
    const parsedOutput = JSON.parse(stdout.trim());
    expect(parsedOutput).toHaveProperty("channel", "test-occupancy-channel");
    expect(parsedOutput).toHaveProperty("metrics");
    expect(parsedOutput.metrics).toMatchObject({
      connections: 10,
      presenceConnections: 5,
      presenceMembers: 8,
      presenceSubscribers: 4,
      publishers: 2,
      subscribers: 6,
    });
    expect(parsedOutput).toHaveProperty("success", true);
  });

  it("should handle empty occupancy metrics", async function () {
    const mock = getMockAblyRest();
    // Override mock to return empty metrics
    mock.request.mockResolvedValue({
      occupancy: {
        metrics: null,
      },
    });

    const { stdout } = await runCommand(
      ["channels:occupancy:get", "test-empty-channel"],
      import.meta.url,
    );

    // Check for expected output with zeros
    expect(stdout).toContain("test-empty-channel");
    expect(stdout).toContain("Connections: 0");
    expect(stdout).toContain("Publishers: 0");
    expect(stdout).toContain("Subscribers: 0");
  });
});
