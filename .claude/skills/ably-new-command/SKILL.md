---
name: ably-new-command
description: "Scaffold new CLI commands with tests for the Ably CLI (oclif + TypeScript). Use this skill whenever creating a new command, adding a new subcommand, migrating/moving a command to a new group, or scaffolding a command with its test file. Triggers on: 'new command', 'add command', 'create command', 'scaffold command', 'add subcommand', 'implement command', or any request to build a new `ably <topic> <action>` command."
---

# Ably CLI New Command

This skill helps you create new commands for the Ably CLI, including the command file, test file, and any needed index/topic files. The Ably CLI is built on oclif (TypeScript) and has strict conventions that every command must follow.

## Step 1: Identify the command pattern

Every command in this CLI falls into one of these patterns. Pick the right one based on what the command does:

| Pattern | When to use | Base class | Client | Example |
|---------|------------|------------|--------|---------|
| **Subscribe** | Long-running event listener | `AblyBaseCommand` | Realtime | `channels subscribe`, `rooms messages subscribe` |
| **Publish/Send** | Send messages | `AblyBaseCommand` | REST or Realtime | `channels publish`, `rooms messages send` |
| **History** | Query past messages/events | `AblyBaseCommand` | REST | `channels history`, `rooms messages history` |
| **Get** | One-shot query for current state | `AblyBaseCommand` | REST | `channels occupancy get`, `rooms occupancy get` |
| **List** | Enumerate resources via REST API | `AblyBaseCommand` | REST | `channels list`, `rooms list` |
| **Enter** | Join presence/space then optionally listen | `AblyBaseCommand` | Realtime | `channels presence enter`, `spaces members enter` |
| **CRUD** | Create/read/update/delete via Control API | `ControlBaseCommand` | Control API (HTTP) | `integrations create`, `queues delete` |

## Step 2: Create the command file

### File location

Commands map to the filesystem: `ably <topic> <subtopic> <action>` lives at `src/commands/<topic>/<subtopic>/<action>.ts`.

If the topic/subtopic doesn't exist yet, you also need an index file at `src/commands/<topic>/<subtopic>/index.ts` (or `src/commands/<topic>/index.ts` for top-level topics). The index file is a simple topic descriptor — read an existing one like `src/commands/channels/index.ts` for the pattern.

### Imports and base class

**Product API commands** (channels, rooms, spaces, presence, pub/sub):
```typescript
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags, clientIdFlag } from "../../flags.js";
import { resource, success, progress, listening, formatTimestamp } from "../../utils/output.js";
```

**Control API commands** (apps, integrations, queues, keys, rules, push config):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { resource, success } from "../../utils/output.js";
```

### Flag sets

Choose the right combination — never add flags a command doesn't need:

```typescript
// Product API command
static override flags = {
  ...productApiFlags,          // Always for product API commands
  ...clientIdFlag,             // See below for when to include this
  // command-specific flags here
};

// Control API command — flags come from ControlBaseCommand.globalFlags automatically
static flags = {
  ...ControlBaseCommand.globalFlags,
  app: Flags.string({
    description: "The app ID or name (defaults to current app)",
    required: false,
  }),
  // command-specific flags here
};
```

**When to include `clientIdFlag`:** Add `...clientIdFlag` whenever the user might want to control which client identity performs the operation. This includes: presence enter/subscribe, spaces members, typing, cursors, publish, and any mutation where permissions may depend on the client (update, delete, annotate). The reason is that users may want to test auth scenarios — e.g., "can client B update client A's message?" — so they need the ability to set their client ID.

For history commands, also use `timeRangeFlags`:
```typescript
import { productApiFlags, timeRangeFlags } from "../../flags.js";
import { parseTimestamp } from "../../utils/time.js";

static override flags = {
  ...productApiFlags,
  ...timeRangeFlags,
  // ...
};
```

### Command metadata

```typescript
export default class TopicAction extends AblyBaseCommand {
  // Imperative mood, sentence case, no trailing period
  static override description = "Subscribe to presence events on a channel";

  static override examples = [
    "$ ably channels presence subscribe my-channel",
    "$ ably channels presence subscribe my-channel --json",
  ];

  static override args = {
    channel: Args.string({
      description: "The channel name",
      required: true,
    }),
  };
```

### Flag naming conventions

- All kebab-case: `--my-flag` (never camelCase)
- `--app`: `"The app ID or name (defaults to current app)"`
- `--limit`: `"Maximum number of results to return (default: N)"`
- `--duration`: `"Automatically exit after N seconds"`, alias `-D`
- `--rewind`: `"Number of messages to rewind when subscribing (default: 0)"`
- Channels use "publish", Rooms use "send" (matches SDK terminology)

### Output patterns

The CLI has specific output helpers in `src/utils/output.ts`. All human-readable output must be wrapped in a JSON guard:

```typescript
// JSON guard — all human output goes through this
if (!this.shouldOutputJson(flags)) {
  this.log(progress("Attaching to channel: " + resource(channelName)));
}

// After success:
if (!this.shouldOutputJson(flags)) {
  this.log(success("Subscribed to channel: " + resource(channelName) + "."));
  this.log(listening("Listening for messages."));
}

// JSON output:
if (this.shouldOutputJson(flags)) {
  this.log(this.formatJsonOutput(data, flags));
}
```

Rules:
- `progress("Action text")` — appends `...` automatically, never add it manually
- `success("Completed action.")` — green checkmark, always end with `.` (period, not `!`)
- `listening("Listening for X.")` — dim text, automatically appends "Press Ctrl+C to exit."
- `resource(name)` — cyan colored, never use quotes around resource names
- `formatTimestamp(ts)` — dim `[timestamp]` for event streams
- `chalk.blue(clientId)` for client IDs
- `chalk.yellow(eventType)` for event types
- `chalk.dim("Label:")` for secondary labels
- Use `this.error()` for fatal errors, never `this.log(chalk.red(...))`
- Never use `console.log` or `console.error` — always `this.log()` or `this.logToStderr()`

### Pattern-specific implementation

#### Subscribe pattern
```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MySubscribeCommand);

  const client = await this.createAblyRealtimeClient(flags);
  if (!client) return;

  this.setupConnectionStateLogging(client, flags);

  const channel = client.channels.get(args.channel, channelOptions);
  this.setupChannelStateLogging(channel, flags);

  if (!this.shouldOutputJson(flags)) {
    this.log(progress("Attaching to channel: " + resource(args.channel)));
  }

  channel.once("attached", () => {
    if (!this.shouldOutputJson(flags)) {
      this.log(success("Attached to channel: " + resource(args.channel) + "."));
      this.log(listening("Listening for events."));
    }
  });

  let sequenceCounter = 0;
  await channel.subscribe((message) => {
    sequenceCounter++;
    // Format and output the message
    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ /* message data */ }, flags));
    } else {
      // Human-readable output with formatTimestamp, resource, chalk colors
    }
  });

  await waitUntilInterruptedOrTimeout(flags);
}
```

Import `waitUntilInterruptedOrTimeout` from `../../utils/long-running.js`.

#### CRUD / Control API pattern
```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyControlCommand);

  const controlApi = this.createControlApi(flags);
  const appId = await this.resolveAppId(flags);

  if (!appId) {
    this.error('No app specified. Use --app flag or select an app with "ably apps switch"');
    return;
  }

  try {
    const result = await controlApi.someMethod(appId, data);

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ result }, flags));
    } else {
      this.log(success("Resource created: " + resource(result.id) + "."));
      // Display additional fields
    }
  } catch (error) {
    this.error(`Error creating resource: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

#### List pattern (Control API or Product API)

List commands query a collection and display results. They don't use `success()` because there's no action to confirm — they just display data. The output format depends on whether items are simple identifiers or structured multi-field records.

**Simple identifier lists** (e.g., `channels list`, `rooms list`) — use `resource()` for each item:
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(`Found ${chalk.cyan(items.length.toString())} active channels:`);
  for (const item of items) {
    this.log(`${resource(item.id)}`);
  }
}
```

**Structured record lists** (e.g., `queues list`, `integrations list`, `push devices list`) — use `chalk.bold()` as a record heading with detail fields below:
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(`Found ${items.length} devices:\n`);
  for (const item of items) {
    this.log(chalk.bold(`Device ID: ${item.id}`));
    this.log(`  ${chalk.dim("Platform:")} ${item.platform}`);
    this.log(`  ${chalk.dim("Push State:")} ${item.pushState}`);
    this.log(`  ${chalk.dim("Client ID:")} ${item.clientId || "N/A"}`);
    this.log("");
  }
}
```

Full Control API list command template:
```typescript
async run(): Promise<void> {
  const { flags } = await this.parse(MyListCommand);

  const controlApi = this.createControlApi(flags);
  const appId = await this.resolveAppId(flags);

  if (!appId) {
    this.error('No app specified. Use --app flag or select an app with "ably apps switch"');
    return;
  }

  try {
    const items = await controlApi.listThings(appId);
    const limited = flags.limit ? items.slice(0, flags.limit) : items;

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ items: limited, total: limited.length, appId }, flags));
    } else {
      this.log(`Found ${limited.length} item${limited.length !== 1 ? "s" : ""}:\n`);
      for (const item of limited) {
        this.log(chalk.bold(`Item ID: ${item.id}`));
        this.log(`  ${chalk.dim("Type:")} ${item.type}`);
        this.log(`  ${chalk.dim("Status:")} ${item.status}`);
        this.log("");
      }
    }
  } catch (error) {
    this.error(`Error listing items: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

Key conventions for list output:
- `resource()` is for inline resource name references (e.g., in simple identifier lists or "Attaching to channel: " + resource(name)), not for record headings
- `chalk.bold()` is for record heading lines that act as visual separators between multi-field records
- `chalk.dim("Label:")` for field labels in detail lines
- `success()` is not used in list commands — it's for confirming an action completed

#### Enter/Presence pattern
```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyEnterCommand);

  const client = await this.createAblyRealtimeClient(flags);
  if (!client) return;

  this.setupConnectionStateLogging(client, flags);

  const channel = client.channels.get(args.channel);
  this.setupChannelStateLogging(channel, flags);

  // Parse optional JSON data (handle shell quote stripping)
  let presenceData;
  if (flags.data) {
    try {
      presenceData = JSON.parse(flags.data);
    } catch {
      this.error("Invalid JSON data provided");
      return;
    }
  }

  if (!this.shouldOutputJson(flags)) {
    this.log(progress("Entering presence on channel: " + resource(args.channel)));
  }

  // Optionally subscribe to other members' events before entering
  if (flags["show-others"]) {
    await channel.presence.subscribe((msg) => {
      if (msg.clientId === client.auth.clientId) return; // filter self
      // Display presence event
    });
  }

  await channel.presence.enter(presenceData);

  if (!this.shouldOutputJson(flags)) {
    this.log(success("Entered presence on channel: " + resource(args.channel) + "."));
    this.log(listening("Present on channel."));
  }

  await waitUntilInterruptedOrTimeout(flags);
}

// Clean up in finally — leave presence
async finally(err: Error | undefined): Promise<void> {
  // Leave presence before closing connection
  return super.finally(err);
}
```

Key flags for enter commands: `--data` (JSON), `--show-others` (boolean), `--duration` / `-D`, `--sequence-numbers`.

#### History pattern
```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyHistoryCommand);

  const rest = await this.createAblyRestClient(flags);
  if (!rest) return;

  const channel = rest.channels.get(args.channel);

  const historyParams = {
    direction: flags.direction,
    limit: flags.limit,
    ...(flags.start && { start: parseTimestamp(flags.start) }),
    ...(flags.end && { end: parseTimestamp(flags.end) }),
  };

  const history = await channel.history(historyParams);
  const messages = history.items;

  if (this.shouldOutputJson(flags)) {
    this.log(this.formatJsonOutput({ messages }, flags));
  } else {
    this.log(success(`Found ${messages.length} messages.`));
    // Display each message
  }
}
```

## Step 3: Create the test file

Test files go at `test/unit/commands/<path-matching-command>.test.ts`.

### Product API test (Realtime mock)

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
});
```

### Product API test (REST mock)

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

### Control API test (nock)

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

### Auth in tests

- **Unit tests**: Auth is automatic via `MockConfigManager`. Never set `ABLY_API_KEY` env var unless testing env var override behavior.
- **Never pass auth flags**: No `--api-key`, `--token`, or `--access-token` in runCommand calls.
- Use `getMockConfigManager().getCurrentAppId()!` to get the test app ID for nock URLs.

### Test structure

Always include these describe blocks:
1. `help` — verify `--help` shows USAGE, key flags, and EXAMPLES
2. `argument validation` — verify required args produce errors when missing
3. `functionality` — core behavior tests
4. `flags` — verify key flags are accepted and configured
5. `error handling` — API errors, invalid input

## Step 4: Create index files if needed

If you're adding a new topic or subtopic, create an index file using `BaseTopicCommand`:

```typescript
// src/commands/push/index.ts
import { BaseTopicCommand } from "../../base-topic-command.js";

export default class Push extends BaseTopicCommand {
  protected topicName = "push";
  protected commandGroup = "Push notification";

  static override description = "Manage push notifications";

  static override examples = [
    "<%= config.bin %> <%= command.id %> devices list",
    "<%= config.bin %> <%= command.id %> config show",
  ];
}
```

For nested subtopics (e.g., `push devices`):
```typescript
// src/commands/push/devices/index.ts
import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushDevices extends BaseTopicCommand {
  protected topicName = "push:devices";
  protected commandGroup = "Push device";

  static override description = "Manage push device registrations";

  static override examples = [
    "<%= config.bin %> <%= command.id %> list",
    "<%= config.bin %> <%= command.id %> get DEVICE_ID",
  ];
}
```

The `topicName` must match the oclif command ID prefix (colons for nesting). The `commandGroup` is used in the help display as "Ably {commandGroup} commands:".

## Step 5: Web CLI restrictions

If the new command shouldn't be available in the web CLI, add it to the appropriate array in `src/base-command.ts`:
- `WEB_CLI_RESTRICTED_COMMANDS` — for commands that don't make sense in a web context
- `WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS` — for commands that expose account/app data
- `INTERACTIVE_UNSUITABLE_COMMANDS` — for commands that don't work in interactive mode

## Step 6: Validate

After creating command and test files, always run:
```bash
pnpm prepare        # Build + update manifest/README
pnpm exec eslint .  # Lint (must be 0 errors)
pnpm test:unit      # Run tests
```

## Checklist

- [ ] Command file at correct path under `src/commands/`
- [ ] Correct base class (`AblyBaseCommand` vs `ControlBaseCommand`)
- [ ] Correct flag set (`productApiFlags` vs `ControlBaseCommand.globalFlags`)
- [ ] `clientIdFlag` only if command needs client identity
- [ ] All human output wrapped in `if (!this.shouldOutputJson(flags))`
- [ ] Output helpers used correctly (`progress`, `success`, `listening`, `resource`, `formatTimestamp`)
- [ ] `success()` messages end with `.` (period)
- [ ] Resource names use `resource(name)`, never quoted
- [ ] Test file at matching path under `test/unit/commands/`
- [ ] Tests use correct mock helper (`getMockAblyRealtime`, `getMockAblyRest`, `nock`)
- [ ] Tests don't pass auth flags — `MockConfigManager` handles auth
- [ ] Index file created if new topic/subtopic
- [ ] `pnpm prepare && pnpm exec eslint . && pnpm test:unit` passes
