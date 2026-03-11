# Test Scaffolds

Test files go at `test/unit/commands/<path-matching-command>.test.ts`.

> **Note:** Do NOT pass `--duration` to `runCommand()` in unit/integration tests. `vitest.config.ts` sets `ABLY_CLI_DEFAULT_DURATION: "0.25"` which makes subscribe commands auto-exit after 250ms. Adding `--duration` overrides this with a slower value.

## Table of Contents
- [Product API Test (Realtime Mock)](#product-api-test-realtime-mock)
- [Product API Test (REST Mock)](#product-api-test-rest-mock)
- [Control API Test](#control-api-test)
- [E2E Tests](#e2e-tests)
- [Standard Test Generators](#standard-test-generators)
- [Test Structure](#test-structure)

---

## Product API Test (Realtime Mock)

For subscribe/realtime commands. Uses `getMockAblyRealtime()` and standard test helpers.

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("topic:action command", () => {
  let mockSubscribeCallback: ((message: unknown) => void) | null = null;

  beforeEach(() => {
    mockSubscribeCallback = null;
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure subscribe to capture the callback
    channel.subscribe.mockImplementation(
      (callback: (msg: unknown) => void) => {
        mockSubscribeCallback = callback;
      },
    );

    // Auto-connect
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") callback();
      },
    );

    // Auto-attach
    channel.once.mockImplementation((event: string, callback: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        callback();
      }
    });
  });

  // Standard helpers generate help, argument validation, and flags blocks
  standardHelpTests("topic:action", import.meta.url);
  standardArgValidationTests("topic:action", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("topic:action", import.meta.url, [
    "--rewind",
    "--json",
  ]);

  describe("functionality", () => {
    it("should subscribe and display events", async () => {
      const commandPromise = runCommand(
        ["topic:action", "test-channel"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: "hello",
        timestamp: Date.now(),
        id: "msg-123",
        clientId: "client-1",
        connectionId: "conn-1",
      });

      const { stdout } = await commandPromise;
      expect(stdout).toContain("test-channel");
    });

    it("should emit JSON envelope for --json events", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["topic:action", "test-channel", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockSubscribeCallback).not.toBeNull();
        });

        mockSubscribeCallback!({
          name: "greeting",
          data: "hi",
          timestamp: Date.now(),
          id: "msg-envelope-test",
          clientId: "client-1",
          connectionId: "conn-1",
        });

        await commandPromise;
      });
      const events = records.filter(
        (r) => r.type === "event" && r.channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("type", "event");
      expect(events[0]).toHaveProperty("command", "topic:action");
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["topic:action", "test-channel"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
```

---

## Product API Test (REST Mock)

For history/get commands. Uses `getMockAblyRest()` and standard test helpers.

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("topic:action command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.history.mockResolvedValue({
      items: [
        {
          id: "msg-1",
          name: "test-event",
          data: { text: "Hello world" },
          timestamp: 1700000000000,
          clientId: "client-1",
          connectionId: "conn-1",
        },
      ],
    });
  });

  // Standard helpers generate help, argument validation, and flags blocks
  standardHelpTests("topic:action", import.meta.url);
  standardArgValidationTests("topic:action", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("topic:action", import.meta.url, [
    "--json",
    "--limit",
    "--direction",
    "--start",
    "--end",
  ]);

  describe("functionality", () => {
    it("should retrieve history", async () => {
      const { stdout } = await runCommand(
        ["topic:action", "test-channel"],
        import.meta.url,
      );
      expect(stdout).toContain("1");
      expect(stdout).toContain("messages");
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["topic:action", "test-channel", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "topic:action");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("messages");
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.history.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["topic:action", "test-channel"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("API error");
    });
  });
});
```

---

## Control API Test

For CRUD commands. Uses `nockControl()`, mock factories, and all standard test helpers including `standardControlApiErrorTests()`.

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";
import { mockQueue } from "../../../fixtures/control-api.js";

describe("topic:action command", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  // Standard helpers generate help, argument validation, and flags blocks
  standardHelpTests("topic:action", import.meta.url);
  standardArgValidationTests("topic:action", import.meta.url);
  standardFlagTests("topic:action", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should list resources", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/resources`)
        .reply(200, [
          mockQueue({ id: "res-1", appId, name: "test-resource" }),
        ]);

      const { stdout } = await runCommand(
        ["topic:action"],
        import.meta.url,
      );

      expect(stdout).toContain("test-resource");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/resources`)
        .reply(200, [
          mockQueue({ id: "res-1", appId, name: "test-resource" }),
        ]);

      const { stdout } = await runCommand(
        ["topic:action", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "topic:action");
      expect(result).toHaveProperty("success", true);
    });
  });

  describe("error handling", () => {
    // Standard 401/500/network error tests — call INSIDE the describe block
    standardControlApiErrorTests({
      commandArgs: ["topic:action"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(`/v1/apps/${appId}/resources`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });

    // Command-specific error tests go alongside the standard ones
    it("should handle 403 forbidden error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/resources`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["topic:action"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
    });
  });
});
```

---

## E2E Tests

E2E tests run against the real Ably service as subprocesses. They go in `test/e2e/<topic>/`.

Key differences from unit tests:
- Auth via env vars (`ABLY_API_KEY`, `ABLY_ACCESS_TOKEN`), not MockConfigManager
- Commands run as spawned child processes, not in-process
- Use helpers from `test/helpers/e2e-test-helper.ts`

### Subscribe E2E scaffold

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import {
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  createTempOutputFile,
  runLongRunningBackgroundProcess,
  readProcessOutput,
  publishTestMessage,
  killProcess,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";

describe.skipIf(SHOULD_SKIP_E2E)("topic:action E2E", { timeout: 60_000 }, () => {
  let subscribeChannel: string;
  let outputPath: string;
  let subscribeProcessInfo: { pid: number; outputPath: string } | null = null;

  beforeAll(() => {
    const handler = () => { cleanupTrackedResources(); process.exit(1); };
    process.on("SIGINT", handler);
    return () => { process.removeListener("SIGINT", handler); };
  });

  afterAll(async () => {
    await cleanupTrackedResources();
  });

  beforeEach(() => {
    resetTestTracking();
    subscribeChannel = getUniqueChannelName("topic-action-e2e");
    outputPath = createTempOutputFile("topic-action");
  });

  afterEach(async () => {
    if (subscribeProcessInfo?.pid) {
      await killProcess(subscribeProcessInfo.pid);
    }
    await cleanupTrackedResources();
  });

  it("should subscribe and receive messages", async () => {
    setupTestFailureHandler("topic:action subscribe");

    subscribeProcessInfo = await runLongRunningBackgroundProcess(
      ["topic:action", subscribeChannel],
      outputPath,
      "Listening",  // ready signal to wait for
      { env: { ABLY_API_KEY: process.env.ABLY_API_KEY! } },
    );

    await publishTestMessage(subscribeChannel, "test-event", { hello: "world" });

    const output = readProcessOutput(outputPath);
    expect(output).toContain("test-event");
  });
});
```

### CRUD E2E scaffold

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "node:child_process";
import {
  SHOULD_SKIP_E2E,
  cleanupTrackedResources,
} from "../../helpers/e2e-test-helper.js";

describe.skipIf(SHOULD_SKIP_E2E)("topic:action CRUD E2E", { timeout: 30_000 }, () => {
  const cliPath = "./bin/run.js";

  afterAll(async () => {
    await cleanupTrackedResources();
  });

  it("should create and list resources", () => {
    const createOutput = execSync(
      `node ${cliPath} topic:action create --name test-resource`,
      { env: { ...process.env, ABLY_ACCESS_TOKEN: process.env.ABLY_ACCESS_TOKEN! } },
    ).toString();
    expect(createOutput).toContain("created");

    const listOutput = execSync(
      `node ${cliPath} topic:action list`,
      { env: { ...process.env, ABLY_ACCESS_TOKEN: process.env.ABLY_ACCESS_TOKEN! } },
    ).toString();
    expect(listOutput).toContain("test-resource");
  });
});
```

---

## Standard Test Generators

The file `test/helpers/standard-tests.ts` provides generator functions that produce the standard describe blocks, reducing boilerplate:

- **`standardHelpTests(command, importMetaUrl)`** — generates the `"help"` describe block, verifying `--help` output contains USAGE
- **`standardArgValidationTests(command, importMetaUrl, options?)`** — generates the `"argument validation"` block. Tests unknown flag rejection. If `options.requiredArgs` is provided, also tests that missing args produce an error.
- **`standardFlagTests(command, importMetaUrl, flags)`** — generates the `"flags"` block, verifying each flag in the array appears in `--help` output
- **`standardControlApiErrorTests(opts)`** — generates 401/500/network error tests for Control API commands. Call **inside** a `describe("error handling", ...)` block (does NOT create the describe block itself). Takes `{ commandArgs, importMetaUrl, setupNock }` where `setupNock(scenario)` receives `"401"`, `"500"`, or `"network"`.

Call the generators at describe-block level (not inside nested describes). You still need to write `"functionality"` and `"error handling"` blocks manually since those are command-specific. For Control API commands, combine `standardControlApiErrorTests()` with command-specific error tests inside the same `describe("error handling", ...)` block.

### Control API Test Helpers

The file `test/helpers/control-api-test-helpers.ts` provides shared helpers for nock-based Control API tests:

- **`nockControl()`** — returns a `nock` scope pre-configured for `https://control.ably.net`
- **`getControlApiContext()`** — returns `{ appId, accountId, mock }` from `MockConfigManager`
- **`controlApiCleanup()`** — calls `nock.cleanAll()` for use in `afterEach` hooks
- **`CONTROL_HOST`** — the default Control API host constant (`"https://control.ably.net"`)

### Mock Factory Functions

The file `test/fixtures/control-api.ts` provides factory functions for realistic Control API response bodies. Each accepts an optional `Partial<T>` to override any field:

- **`mockApp(overrides?)`** — mock app object (id, name, status, tlsOnly, etc.)
- **`mockKey(overrides?)`** — mock API key object (id, key, capability, etc.)
- **`mockRule(overrides?)`** — mock integration rule object (ruleType, source, target, etc.)
- **`mockQueue(overrides?)`** — mock queue object (name, region, state, messages, stats, amqp, stomp, etc.)
- **`mockNamespace(overrides?)`** — mock namespace object (id, persisted, pushEnabled, etc.)
- **`mockStats(overrides?)`** — mock stats object (intervalId, unit, all.messages, etc.)

### NDJSON Test Helpers

The file `test/helpers/ndjson.ts` provides helpers for testing JSON output:

- **`parseNdjsonLines(stdout)`** — parse stdout containing one JSON object per line into an array of records
- **`parseLogLines(lines)`** — parse an array of log lines into JSON records (skips non-JSON)
- **`captureJsonLogs(fn)`** — capture all `console.log` output from an async function and parse as JSON records. Use to verify JSON envelope structure in `--json` mode.

---

## Test Structure

Every test file MUST include all 5 of these describe blocks (exact names — no variants):

1. **`help`** — verify `--help` shows USAGE, key flags, and EXAMPLES
2. **`argument validation`** — verify required args produce errors when missing. For commands with no required args, test that unknown flags are rejected.
3. **`functionality`** — core happy-path behavior tests. This is where the main command logic is tested.
4. **`flags`** — verify key flags are accepted and configured (check help output contains flag names, test flag behavior)
5. **`error handling`** — API errors, invalid input, network failures

### Block naming rules
- Use EXACTLY these names: `"help"`, `"argument validation"`, `"functionality"`, `"flags"`, `"error handling"`
- Do NOT use variants like `"command arguments and flags"`, `"command flags"`, `"flag options"`, `"parameter validation"`, or domain-specific names like `"subscription behavior"`
- Additional describe blocks beyond the 5 required ones are fine (e.g., `"JSON output"`, `"cleanup behavior"`)

### What goes in each block

**`argument validation`** for commands WITH required args:
```typescript
describe("argument validation", () => {
  it("should require channel argument", async () => {
    const { error } = await runCommand(["topic:action"], import.meta.url);
    expect(error?.message).toMatch(/Missing .* required arg/i);
  });
});
```

**`argument validation`** for commands WITHOUT required args:
```typescript
describe("argument validation", () => {
  it("should reject unknown flags", async () => {
    const { error } = await runCommand(
      ["topic:action", "--unknown-flag-xyz"],
      import.meta.url,
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
  });
});
```

**`argument validation`** for topic commands (that route to subcommands):
```typescript
describe("argument validation", () => {
  it("should handle unknown subcommand gracefully", async () => {
    const { stdout } = await runCommand(["topic", "nonexistent"], import.meta.url);
    expect(stdout).toBeDefined();
  });
});
```

**`flags`** block pattern:
```typescript
describe("flags", () => {
  it("should show available flags in help", async () => {
    const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
    expect(stdout).toContain("--json");
  });

  it("should reject unknown flags", async () => {
    const { error } = await runCommand(
      ["topic:action", "test-arg", "--unknown-flag"],
      import.meta.url,
    );
    expect(error).toBeDefined();
  });
});
```
