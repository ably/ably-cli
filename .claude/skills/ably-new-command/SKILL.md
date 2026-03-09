---
name: ably-new-command
description: "Scaffold new CLI commands with tests for the Ably CLI (oclif + TypeScript). Use this skill whenever creating a new command, adding a new subcommand, migrating/moving a command to a new group, or scaffolding a command with its test file. Triggers on: 'new command', 'add command', 'create command', 'scaffold command', 'add subcommand', 'implement command', or any request to build a new `ably <topic> <action>` command. IMPORTANT: This skill MUST be used any time the user wants to create, build, or implement ANY new CLI command or subcommand — even if they describe it casually (e.g., 'I need an ably X Y command', 'can you build ably rooms typing subscribe', 'we should add a purge command to queues'). Also use when moving or restructuring existing commands to new locations. Do NOT use for modifying existing commands, fixing bugs, debugging, adding tests to existing commands, or refactoring — only for creating net-new command files."
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

**Specialized base classes** — some command groups have dedicated base classes that handle common setup (client lifecycle, cleanup, shared flags):

| Pattern | Base class | When to use | Source |
|---------|-----------|-------------|--------|
| Chat commands | `ChatBaseCommand` | `rooms messages`, `rooms reactions`, `rooms typing`, `rooms occupancy` | `src/chat-base-command.ts` |
| Spaces commands | `SpacesBaseCommand` | `spaces members`, `spaces locks`, `spaces cursors`, `spaces locations` | `src/spaces-base-command.ts` |
| Stats commands | `StatsBaseCommand` | `stats app`, `stats account` | `src/stats-base-command.ts` |

If your command falls into one of these groups, extend the specialized base class instead of `AblyBaseCommand` or `ControlBaseCommand` directly. **Exception:** if your command only needs a REST client (e.g., history queries that don't enter a space or join a room), you may use `AblyBaseCommand` directly — the specialized base class is most valuable when the command needs realtime connections, cleanup lifecycle, or shared setup like `room.attach()` / `space.enter()`.

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
import { resource, success, progress, listening, formatTimestamp, clientId, eventType, label, heading, index } from "../../utils/output.js";
```

**Control API commands** (apps, integrations, queues, keys, rules, push config):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { resource, success, label, heading } from "../../utils/output.js";
```

**Chat commands** (rooms messages, reactions, typing, occupancy):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../chat-base-command.js";
import { productApiFlags, clientIdFlag } from "../../flags.js";
import { resource, success, progress, listening } from "../../utils/output.js";
```

**Spaces commands** (spaces members, locks, cursors, locations):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../spaces-base-command.js";
import { productApiFlags, clientIdFlag } from "../../flags.js";
import { resource, success, progress, listening, clientId } from "../../utils/output.js";
```

**Stats commands** (stats app, stats account):
```typescript
import { Args, Flags } from "@oclif/core";

import { StatsBaseCommand } from "../../stats-base-command.js";
```

**Import depth:** These examples use `../../` which is correct for `src/commands/<topic>/<action>.ts`. For deeper nesting like `src/commands/<topic>/<subtopic>/<action>.ts`, add one more `../` per level (e.g., `../../../base-command.js`). Always count the directory levels from your command file back to `src/`.

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

**Output helper reference** — all exported from `src/utils/output.ts`:

| Helper | Usage | Example |
|--------|-------|---------|
| `progress(msg)` | Action in progress — appends `...` automatically | `progress("Attaching to channel")` |
| `success(msg)` | Green checkmark — always end with `.` (period, not `!`) | `success("Subscribed to channel " + resource(name) + ".")` |
| `listening(msg)` | Dim text — auto-appends "Press Ctrl+C to exit." | `listening("Listening for messages.")` |
| `resource(name)` | Cyan — for resource names, never use quotes | `resource(channelName)` |
| `formatTimestamp(ts)` | Dim `[timestamp]` — for event streams | `formatTimestamp(isoString)` |
| `formatMessageTimestamp(ts)` | Converts Ably message timestamp to ISO string | `formatMessageTimestamp(message.timestamp)` |
| `countLabel(n, singular, plural?)` | Cyan count + pluralized label | `countLabel(3, "message")` → "3 messages" |
| `limitWarning(count, limit, name)` | Yellow warning if results truncated, null otherwise | `limitWarning(items.length, flags.limit, "items")` |
| `formatPresenceAction(action)` | Returns `{ symbol, color }` for enter/leave/update | `formatPresenceAction("enter")` → `{ symbol: "✓", color: chalk.green }` |
| `clientId(id)` | Blue — for client identity display | `clientId(msg.clientId)` |
| `eventType(type)` | Yellow — for event/action type labels | `eventType("enter")` |
| `label(text)` | Dim with colon — for field labels in structured output | `label("Platform")` → dim "Platform:" |
| `heading(text)` | Bold — for record headings in list output | `heading("Device ID: " + id)` |
| `index(n)` | Dim bracketed number — for history ordering | `index(1)` → dim "[1]" |

Rules:
- `progress("Action text")` — appends `...` automatically, never add it manually
- `success("Completed action.")` — green checkmark, always end with `.` (period, not `!`)
- `listening("Listening for X.")` — dim text, automatically appends "Press Ctrl+C to exit."
- `resource(name)` — cyan colored, never use quotes around resource names
- `formatTimestamp(ts)` — dim `[timestamp]` for event streams
- `clientId(id)` — blue, for client identity in events (replaces `chalk.blue(id)`)
- `eventType(type)` — yellow, for event/action labels (replaces `chalk.yellow(type)`)
- `label(text)` — dim with colon, for field labels (replaces `chalk.dim("Label:")`)
- `heading(text)` — bold, for record headings in lists (replaces `chalk.bold("Heading")`)
- `index(n)` — dim bracketed number, for history ordering (replaces `chalk.dim(\`[${n}]\`)`)
- Use `this.error()` for fatal errors, never `this.log(chalk.red(...))`
- Never use `console.log` or `console.error` — always `this.log()` or `this.logToStderr()`

### Error handling

Use these patterns for error handling in commands:

- **`this.error(message)`** — Fatal errors (oclif standard). Throws, so no `return` needed after it.
- **`this.handleCommandError(error, flags, component, context?)`** — Use in catch blocks. Logs the CLI event, emits JSON error when `--json` is active, and calls `this.error()` for human-readable output.
- **`this.jsonError(data, flags)`** — JSON-specific error output for non-standard error flows.

Catch block template:
```typescript
try {
  // command logic
} catch (error) {
  this.handleCommandError(
    error,
    flags,
    "ComponentName",     // e.g., "ChannelPublish", "PresenceEnter"
    { channel: args.channel },  // optional context for logging
  );
}
```

For simple Control API errors where you don't need event logging:
```typescript
try {
  const result = await controlApi.someMethod(appId, data);
  // handle result
} catch (error) {
  this.error(`Error creating resource: ${error instanceof Error ? error.message : String(error)}`);
}
```

### Pattern-specific implementation

Read `references/patterns.md` for the full implementation template matching your pattern (Subscribe, Publish/Send, History, Enter/Presence, List, CRUD/Control API). Each template includes the correct flags, `run()` method structure, and output conventions.

## Step 3: Create the test file

Read `references/testing.md` for the full test scaffold matching your command type (Realtime mock, REST mock, Control API with nock, E2E subscribe, E2E CRUD). Test files go at `test/unit/commands/<path-matching-command>.test.ts`.

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
- [ ] Correct base class (`AblyBaseCommand`, `ControlBaseCommand`, `ChatBaseCommand`, `SpacesBaseCommand`, or `StatsBaseCommand`)
- [ ] Correct flag set (`productApiFlags` vs `ControlBaseCommand.globalFlags`)
- [ ] `clientIdFlag` only if command needs client identity
- [ ] All human output wrapped in `if (!this.shouldOutputJson(flags))`
- [ ] Output helpers used correctly (`progress`, `success`, `listening`, `resource`, `formatTimestamp`, `clientId`, `eventType`, `label`, `heading`, `index`)
- [ ] `success()` messages end with `.` (period)
- [ ] Resource names use `resource(name)`, never quoted
- [ ] Error handling uses `this.handleCommandError()` or `this.error()`, not `this.log(chalk.red(...))`
- [ ] Test file at matching path under `test/unit/commands/`
- [ ] Tests use correct mock helper (`getMockAblyRealtime`, `getMockAblyRest`, `nock`)
- [ ] Tests don't pass auth flags — `MockConfigManager` handles auth
- [ ] Subscribe tests use `--duration` flag to auto-exit
- [ ] Index file created if new topic/subtopic
- [ ] `pnpm prepare && pnpm exec eslint . && pnpm test:unit` passes
