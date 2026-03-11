# Test Scaffolds

Test files go at `test/unit/commands/<path-matching-command>.test.ts`.

> **Note:** Do NOT pass `--duration` to `runCommand()` in unit/integration tests. `vitest.config.ts` sets `ABLY_CLI_DEFAULT_DURATION: "0.25"` which makes subscribe commands auto-exit after 250ms. Adding `--duration` overrides this with a slower value.

## Table of Contents
- [Product API Test (Realtime Mock)](#product-api-test-realtime-mock)
- [Product API Test (REST Mock)](#product-api-test-rest-mock)
- [Control API Test (nock)](#control-api-test-nock)
- [E2E Tests](#e2e-tests)
- [Test Structure](#test-structure)

---

## Product API Test (Realtime Mock)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("topic:action command", () => {
  let mockCallback: ((event: unknown) => void) | null = null;

  beforeEach(() => {
    mockCallback = null;
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure subscribe to capture the callback
    channel.subscribe.mockImplementation((callback: (msg: unknown) => void) => {
      mockCallback = callback;
    });

    // Auto-connect
    mock.connection.once.mockImplementation((event: string, cb: () => void) => {
      if (event === "connected") cb();
    });

    // Auto-attach
    channel.once.mockImplementation((event: string, cb: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        cb();
      }
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(["topic:action"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/channel|required|argument/i);
    });
  });

  describe("functionality", () => {
    it("should subscribe and display events", async () => {
      const commandPromise = runCommand(["topic:action", "test-channel"], import.meta.url);

      await vi.waitFor(() => { expect(mockCallback).not.toBeNull(); });

      mockCallback!({
        name: "test-event",
        data: "hello",
        timestamp: Date.now(),
      });

      const { stdout } = await commandPromise;
      expect(stdout).toContain("test-channel");
    });
  });

  describe("flags", () => {
    it("should accept --duration flag", async () => {
      const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
      expect(stdout).toContain("--duration");
    });
  });

  describe("error handling", () => {
    it("should handle connection failure", async () => {
      const mock = getMockAblyRealtime();
      mock.connection.once.mockImplementation((event: string, cb: (stateChange: unknown) => void) => {
        if (event === "failed") cb({ reason: new Error("Connection failed") });
      });

      const { error } = await runCommand(
        ["topic:action", "test-channel"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
```

---

## Product API Test (REST Mock)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("topic:action command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.history.mockResolvedValue({
      items: [
        { id: "msg-1", name: "event", data: "hello", timestamp: 1700000000000 },
      ],
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(["topic:action"], import.meta.url);
      expect(error?.message).toMatch(/Missing .* required arg/i);
    });
  });

  describe("functionality", () => {
    it("should retrieve history", async () => {
      const { stdout } = await runCommand(
        ["topic:action", "test-channel"],
        import.meta.url,
      );
      expect(stdout).toContain("1");
      expect(stdout).toContain("messages");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
      expect(stdout).toContain("--json");
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
    });
  });
});
```

---

## Control API Test (nock)

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("topic:action command", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
      expect(stdout).toContain("USAGE");
    });
  });

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

  describe("functionality", () => {
    it("should create resource", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/resources`)
        .reply(201, { id: "res-123", appId });

      const { stdout } = await runCommand(
        ["topic:action", "--flag", "value"],
        import.meta.url,
      );

      expect(stdout).toContain("created");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(["topic:action", "--help"], import.meta.url);
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/resources`)
        .reply(400, { error: "Bad request" });

      const { error } = await runCommand(
        ["topic:action", "--flag", "value"],
        import.meta.url,
      );

      expect(error).toBeDefined();
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
