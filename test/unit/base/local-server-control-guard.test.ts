/**
 * Control plane behaviour for local server accounts.
 *
 * A local server account only reaches a Control API if one was configured at
 * login, so control commands must fail with an actionable message rather than
 * silently querying the managed Control API.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../helpers/mock-config-manager.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe("local server control plane guard", () => {
  beforeEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;
    delete process.env.ABLY_CONTROL_HOST;

    const mock = getMockConfigManager();
    mock.clearAccounts();
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;
    delete process.env.ABLY_CONTROL_HOST;
  });

  it("fails control commands for a local account with no control plane", async () => {
    const mock = getMockConfigManager();
    mock.storeLocalAccount("local", {
      accountName: "local",
      dataPlane: { endpoint: "localhost", port: 8081, tls: false },
    });
    mock.switchAccount("local");

    const { stdout } = await runCommand(
      ["apps:list", "--json"],
      import.meta.url,
    );

    const result = parseNdjsonLines(stdout).find((r) => r.type === "error")!;
    expect(result.error.message).toContain("aren't available for local server");
    expect(result.error.message).toContain("--control-url");
  });

  it("routes control commands to the stored control URL when one is configured", async () => {
    const mock = getMockConfigManager();
    mock.storeLocalAccount("local", {
      accessToken: "local-control-token",
      accountName: "local",
      controlUrl: "http://localhost:8082",
      dataPlane: { endpoint: "localhost", port: 8081, tls: false },
    });
    mock.switchAccount("local");

    nock("http://localhost:8082")
      .get("/v1/me")
      .reply(200, {
        account: { id: "local-account", name: "Local" },
        user: { email: "dev@localhost" },
      });
    nock("http://localhost:8082")
      .get("/v1/accounts/local-account/apps")
      .reply(200, [
        {
          accountId: "local-account",
          created: 1_700_000_000_000,
          id: "localapp",
          modified: 1_700_000_000_000,
          name: "Local App",
          status: "enabled",
          tlsOnly: false,
        },
      ]);

    const { stdout } = await runCommand(
      ["apps:list", "--json"],
      import.meta.url,
    );

    const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
    expect(result).toHaveProperty("success", true);
    expect(JSON.stringify(result)).toContain("localapp");
  });
});
