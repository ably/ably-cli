import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("stats:app command", () => {
  const mockAccessToken = "fake_access_token";
  const mockStats = [
    {
      intervalId: "2023-01-01:00:00",
      unit: "minute",
      all: {
        messages: { count: 100, data: 5000 },
        all: { count: 100, data: 5000 },
      },
    },
  ];

  let appId: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;
    const mockConfig = getMockConfigManager();
    appId = mockConfig.getCurrentAppId()!;
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  it("should accept ISO 8601 for --start and --end", async () => {
    const scope = nock("https://control.ably.net")
      .get(`/v1/apps/${appId}/stats`)
      .query(true)
      .reply(200, mockStats);

    const { stdout } = await runCommand(
      [
        "stats:app",
        appId,
        "--start",
        "2023-01-01T00:00:00Z",
        "--end",
        "2023-01-02T00:00:00Z",
      ],
      import.meta.url,
    );

    expect(scope.isDone()).toBe(true);
    expect(stdout).toContain("2023-01-01");
  });

  it("should accept relative time for --start", async () => {
    const scope = nock("https://control.ably.net")
      .get(`/v1/apps/${appId}/stats`)
      .query(true)
      .reply(200, mockStats);

    const { stdout } = await runCommand(
      ["stats:app", appId, "--start", "1h"],
      import.meta.url,
    );

    expect(scope.isDone()).toBe(true);
    expect(stdout).toContain("2023-01-01");
  });

  it("should accept Unix ms for --start", async () => {
    const scope = nock("https://control.ably.net")
      .get(`/v1/apps/${appId}/stats`)
      .query(true)
      .reply(200, mockStats);

    const { stdout } = await runCommand(
      ["stats:app", appId, "--start", "1672531200000"],
      import.meta.url,
    );

    expect(scope.isDone()).toBe(true);
    expect(stdout).toContain("2023-01-01");
  });
});
