# Test Scaffolds

Test files go at `test/unit/commands/<path-matching-command>.test.ts`.

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
      const commandPromise = runCommand(["topic:action", "test-channel", "--duration", "1"], import.meta.url);

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

  it("should retrieve history", async () => {
    const { stdout } = await runCommand(
      ["topic:action", "test-channel"],
      import.meta.url,
    );
    expect(stdout).toContain("1");
    expect(stdout).toContain("messages");
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

Always include these describe blocks:
1. `help` — verify `--help` shows USAGE, key flags, and EXAMPLES
2. `argument validation` — verify required args produce errors when missing
3. `functionality` — core behavior tests
4. `flags` — verify key flags are accepted and configured
5. `error handling` — API errors, invalid input
