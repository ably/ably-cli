import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("spaces:list command", () => {
  const mockSpaceChannelsResponse = {
    statusCode: 200,
    items: [
      {
        channelId: "space1::$space::$locks",
        status: {
          occupancy: {
            metrics: { connections: 3, publishers: 1, subscribers: 2 },
          },
        },
      },
      {
        channelId: "space1::$space::$cursors",
        status: {
          occupancy: { metrics: { connections: 2 } },
        },
      },
      {
        channelId: "space2::$space::$locks",
        status: {
          occupancy: {
            metrics: { connections: 1, publishers: 0, subscribers: 1 },
          },
        },
      },
      {
        channelId: "regular-channel",
        status: {
          occupancy: { metrics: { connections: 1 } },
        },
      },
    ],
  };

  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue(mockSpaceChannelsResponse);
  });

  it("should filter to ::$space channels only", async () => {
    const { stdout } = await runCommand(["spaces:list"], import.meta.url);

    expect(stdout).toContain("space1");
    expect(stdout).toContain("space2");
    expect(stdout).not.toContain("regular-channel");
  });

  it("should deduplicate spaces from sub-channels", async () => {
    const { stdout } = await runCommand(["spaces:list"], import.meta.url);

    // space1 has 2 sub-channels but should appear only once
    expect(stdout).toContain("2");
    expect(stdout).toContain("active spaces");
  });

  it("should extract space name from channel ID", async () => {
    const { stdout } = await runCommand(["spaces:list"], import.meta.url);

    expect(stdout).toContain("space1");
    expect(stdout).not.toContain("::$space::$locks");
  });

  it("should respect --limit flag", async () => {
    const { stdout } = await runCommand(
      ["spaces:list", "--limit", "1"],
      import.meta.url,
    );

    expect(stdout).toContain("space1");
    expect(stdout).not.toContain("space2");
  });

  it("should forward --prefix flag to API", async () => {
    const mock = getMockAblyRest();

    await runCommand(["spaces:list", "--prefix", "space1"], import.meta.url);

    expect(mock.request).toHaveBeenCalledOnce();
    expect(mock.request.mock.calls[0][3]).toHaveProperty("prefix", "space1");
  });

  it("should show 'No active spaces' on empty response", async () => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue({ statusCode: 200, items: [] });

    const { stdout } = await runCommand(["spaces:list"], import.meta.url);

    expect(stdout).toContain("No active spaces found");
  });

  it("should output JSON with correct structure", async () => {
    const { stdout } = await runCommand(
      ["spaces:list", "--json"],
      import.meta.url,
    );

    const json = JSON.parse(stdout);
    expect(json).toHaveProperty("spaces");
    expect(json).toHaveProperty("total");
    expect(json).toHaveProperty("shown");
    expect(json).toHaveProperty("hasMore");
    expect(json).toHaveProperty("success", true);
    expect(json.spaces).toBeInstanceOf(Array);
    expect(json.spaces.length).toBe(2);
    expect(json.spaces[0]).toHaveProperty("spaceName", "space1");
    expect(json.spaces[1]).toHaveProperty("spaceName", "space2");
  });
});
