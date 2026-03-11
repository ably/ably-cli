import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { runCommand } from "@oclif/test";

describe("stats:account command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockStats = [
    {
      intervalId: "2023-01-01:00:00",
      unit: "minute",
      all: {
        messages: { count: 200, data: 10000 },
        all: { count: 200, data: 10000 },
      },
    },
  ];

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  function mockMeEndpoint() {
    // Called once for showAuthInfoIfNeeded, once for runOneTimeStats
    nock("https://control.ably.net")
      .get("/v1/me")
      .times(2)
      .reply(200, {
        account: { id: mockAccountId, name: "Test Account" },
        user: { email: "test@example.com" },
      });
  }

  it("should accept ISO 8601 for --start and --end", async () => {
    mockMeEndpoint();
    const scope = nock("https://control.ably.net")
      .get(`/v1/accounts/${mockAccountId}/stats`)
      .query(true)
      .reply(200, mockStats);

    const { stdout } = await runCommand(
      [
        "stats:account",
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
    mockMeEndpoint();
    const scope = nock("https://control.ably.net")
      .get(`/v1/accounts/${mockAccountId}/stats`)
      .query(true)
      .reply(200, mockStats);

    const { stdout } = await runCommand(
      ["stats:account", "--start", "1h"],
      import.meta.url,
    );

    expect(scope.isDone()).toBe(true);
    expect(stdout).toContain("2023-01-01");
  });

  it("should accept Unix ms for --start", async () => {
    mockMeEndpoint();
    const scope = nock("https://control.ably.net")
      .get(`/v1/accounts/${mockAccountId}/stats`)
      .query(true)
      .reply(200, mockStats);

    const { stdout } = await runCommand(
      ["stats:account", "--start", "1672531200000"],
      import.meta.url,
    );

    expect(scope.isDone()).toBe(true);
    expect(stdout).toContain("2023-01-01");
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["stats:account", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["stats:account", "--unknown-flag-xyz"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should display account stats successfully", async () => {
      mockMeEndpoint();
      const scope = nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/stats`)
        .query(true)
        .reply(200, mockStats);

      const { stdout, error } = await runCommand(
        ["stats:account", "--start", "1h"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["stats:account", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .times(2)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["stats:account"], import.meta.url);
      expect(error).toBeDefined();
    });
  });
});
