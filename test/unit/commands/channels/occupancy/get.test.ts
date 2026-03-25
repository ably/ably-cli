import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

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
                objectPublishers: 0,
                objectSubscribers: 0,
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
    expect(stdout).toContain("Object Publishers: 0");
    expect(stdout).toContain("Object Subscribers: 0");
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
    expect(parsedOutput).toHaveProperty("occupancy");
    expect(parsedOutput.occupancy).toHaveProperty(
      "channelName",
      "test-occupancy-channel",
    );
    expect(parsedOutput.occupancy.metrics).toMatchObject({
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

    // Check for expected output with zeros — all 6 fields shown unconditionally
    expect(stdout).toContain("test-empty-channel");
    expect(stdout).toContain("Connections: 0");
    expect(stdout).toContain("Publishers: 0");
    expect(stdout).toContain("Subscribers: 0");
    expect(stdout).toContain("Presence Connections: 0");
    expect(stdout).toContain("Presence Members: 0");
    expect(stdout).toContain("Presence Subscribers: 0");
    expect(stdout).toContain("Object Publishers: 0");
    expect(stdout).toContain("Object Subscribers: 0");
  });

  describe("functionality", () => {
    it("should retrieve and display occupancy data for a channel", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["channels:occupancy:get", "my-channel"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      expect(mock.request.mock.calls[0][1]).toBe("/channels/my-channel");
      expect(stdout).toContain("my-channel");
      expect(stdout).toContain("Connections: 10");
      expect(stdout).toContain("Subscribers: 6");
    });
  });

  standardHelpTests("channels:occupancy:get", import.meta.url);
  standardArgValidationTests("channels:occupancy:get", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:occupancy:get", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:occupancy:get", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
