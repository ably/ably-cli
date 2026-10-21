/**
 * TTY-dependent Ctrl+C tests for `ably accounts login`.
 *
 * Both failures only reproduce in a real terminal, so they can't be covered by
 * unit tests:
 *   - ora's stdin-discarder puts the TTY in raw mode and then never reads the
 *     Ctrl+C byte, so Ctrl+C during "Waiting for authorization..." was ignored.
 *   - After that spinner has run, inquirer's re-raised SIGINT at a select
 *     prompt was never delivered: the prompt had closed its input, so Node
 *     ran out of work first and reported "Detected unsettled top-level await".
 *
 * A local HTTP server stands in for both the OAuth device flow and the
 * Control API so the command runs end to end.
 *
 * Run locally with: pnpm test:tty
 * NOT run in CI — GitHub Actions runners have no TTY.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  spawnTty,
  waitForOutput,
  sendCtrlC,
  killTty,
  type TtyProcess,
} from "../tty-test-helper.js";

interface FakeServer {
  host: string;
  close: () => Promise<void>;
}

/**
 * Serve the OAuth device flow and the Control API endpoints login calls.
 * `grantToken` decides whether polling succeeds straight away or keeps
 * returning `authorization_pending`; with `noApps`, login offers to create
 * one instead of prompting for a key.
 */
async function startFakeServer(
  grantToken: boolean,
  { noApps = false } = {},
): Promise<FakeServer> {
  const routes: Record<string, () => [number, unknown]> = {
    "/oauth/authorize_device": () => [
      200,
      {
        device_code: "device-code",
        expires_in: 600,
        interval: 1,
        user_code: "ABCD-EFGH",
        verification_uri: "http://localhost/oauth/device",
        verification_uri_complete:
          "http://localhost/oauth/device?user_code=ABCD-EFGH",
      },
    ],
    "/oauth/token": () =>
      grantToken
        ? [200, { access_token: "access", refresh_token: "refresh" }]
        : [400, { error: "authorization_pending" }],
    "/api/v1/me": () => [
      200,
      {
        account: { id: "acc-1", name: "Test Account" },
        user: { email: "user@example.com" },
      },
    ],
    "/api/v1/me/accounts": () => [200, [{ id: "acc-1", name: "Test Account" }]],
    "/api/v1/accounts/acc-1/apps": () => [
      200,
      noApps ? [] : [{ accountId: "acc-1", id: "app-1", name: "Test App" }],
    ],
    // Two keys, so login has to prompt for one.
    "/api/v1/apps/app-1/keys": () => [
      200,
      ["key-1", "key-2"].map((id) => ({
        appId: "app-1",
        capability: {},
        created: 0,
        id,
        key: `app-1.${id}:secret`,
        modified: 0,
        name: `Key ${id}`,
        revocable: true,
        status: 0,
      })),
    ],
  };

  const server = http.createServer((req, res) => {
    const route = routes[new URL(req.url ?? "/", "http://x").pathname];
    const [status, body] = route ? route() : [404, { error: "not_found" }];
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });

  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    host: `localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

describe("accounts login - Ctrl+C handling (TTY)", () => {
  const timeout = 20000;
  let proc: TtyProcess | null = null;
  let server: FakeServer | null = null;
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ably-login-tty-"));
  });

  afterEach(async () => {
    if (proc) {
      await killTty(proc);
      proc = null;
    }
    await server?.close();
    server = null;
    fs.rmSync(configDir, { force: true, recursive: true });
  });

  function spawnLogin(host: string): TtyProcess {
    return spawnTty(
      [
        "accounts",
        "login",
        "--no-browser",
        "--skip-logo",
        "--oauth-host",
        host,
        "--control-host",
        host,
      ],
      {
        ABLY_ACCESS_TOKEN: undefined,
        ABLY_API_KEY: undefined,
        ABLY_CLI_CONFIG_DIR: configDir,
        // Exercise the real exit path rather than test mode's throwing one.
        ABLY_CLI_TEST_MODE: undefined,
        ABLY_INTERACTIVE_MODE: "false",
        ABLY_TOKEN: undefined,
      },
    );
  }

  it(
    "exits with 130 when Ctrl+C is pressed while waiting for authorization",
    async () => {
      server = await startFakeServer(false);
      proc = spawnLogin(server.host);

      await waitForOutput(proc, "Waiting for authorization");
      sendCtrlC(proc);

      const { code } = await proc.exitPromise;
      expect(code).toBe(130);
      expect(proc.output).toContain("Authentication cancelled.");
      expect(proc.output).not.toContain("ExitError");
    },
    timeout,
  );

  it(
    "exits with 130 when Ctrl+C is pressed at a prompt after authorization",
    async () => {
      server = await startFakeServer(true);
      proc = spawnLogin(server.host);

      await waitForOutput(proc, "Select a key");
      sendCtrlC(proc);

      const { code } = await proc.exitPromise;
      expect(code).toBe(130);
      expect(proc.output).not.toContain("unsettled top-level await");
    },
    timeout,
  );

  it(
    "exits with 130 when Ctrl+C is pressed at a confirmation after authorization",
    async () => {
      server = await startFakeServer(true, { noApps: true });
      proc = spawnLogin(server.host);

      await waitForOutput(proc, "create your first app");
      sendCtrlC(proc);

      const { code } = await proc.exitPromise;
      expect(code).toBe(130);
      expect(proc.output).not.toContain("Could not fetch apps");
    },
    timeout,
  );
});
