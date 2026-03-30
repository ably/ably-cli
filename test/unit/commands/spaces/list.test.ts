import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

function createMockSpaceChannelItems() {
  return [
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
  ];
}

describe("spaces:list command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockClear();
    mock.request.mockResolvedValue({
      ...createMockPaginatedResult(createMockSpaceChannelItems()),
      statusCode: 200,
    });
  });

  standardHelpTests("spaces:list", import.meta.url);
  standardArgValidationTests("spaces:list", import.meta.url);
  standardFlagTests("spaces:list", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should list active spaces successfully", async () => {
      const { stdout, error } = await runCommand(
        ["spaces:list"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain("space1");
      expect(stdout).toContain("space2");
      expect(stdout).not.toContain("regular-channel");
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

    it("should show 'No active spaces' on empty response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        ...createMockPaginatedResult([]),
        statusCode: 200,
      });

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
      expect(json).toHaveProperty("hasMore");
      expect(json).toHaveProperty("success", true);
      expect(json.spaces).toBeInstanceOf(Array);
      expect(json.spaces.length).toBe(2);
      expect(json.spaces[0]).toHaveProperty("spaceName", "space1");
      expect(json.spaces[1]).toHaveProperty("spaceName", "space2");
    });
  });

  describe("flags", () => {
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
  });

  it("should deduplicate across multiple pages and show pagination warning", async () => {
    const mock = getMockAblyRest();
    const page1 = [
      {
        channelId: "space1::$space::$locks",
        status: { occupancy: { metrics: { connections: 1 } } },
      },
      {
        channelId: "space1::$space::$cursors",
        status: { occupancy: { metrics: { connections: 1 } } },
      },
    ];
    const page2 = [
      {
        channelId: "space1::$space::$locations",
        status: { occupancy: { metrics: { connections: 1 } } },
      },
      {
        channelId: "space2::$space::$locks",
        status: { occupancy: { metrics: { connections: 2 } } },
      },
    ];
    mock.request.mockResolvedValue({
      ...createMockPaginatedResult(page1, page2),
      statusCode: 200,
    });

    const { stdout } = await runCommand(
      ["spaces:list", "--limit", "10"],
      import.meta.url,
    );

    // space1 appears on both pages but should be deduplicated
    expect(stdout).toContain("space1");
    expect(stdout).toContain("space2");
    expect(stdout).toContain("2 active spaces");
    // Pagination warning for multi-page fetch
    expect(stdout).toContain("pages");
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(["spaces:list"], import.meta.url);
      expect(error).toBeDefined();
    });

    it("should surface errorCode and errorMessage from HTTP response", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        statusCode: 401,
        errorCode: 40101,
        errorMessage: "Invalid credentials",
      });

      const { error } = await runCommand(["spaces:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid credentials");
      expect(error?.message).toContain("40101");
    });
  });
});
