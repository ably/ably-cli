---
name: ably-new-command
description: "Scaffold new CLI commands with tests for the Ably CLI (oclif + TypeScript). Use this skill whenever creating a new command, adding a subcommand, migrating a command, or scaffolding a command with its test file — even if described casually (e.g., 'I need an ably X Y command', 'can you build ably rooms typing subscribe', 'we should add a purge command to queues'). Do NOT use for modifying existing commands, fixing bugs, or adding tests to existing commands."
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
| **REST Mutation** | One-shot REST mutation (no subscription) | `AblyBaseCommand` | REST | `rooms messages update`, `rooms messages delete` |
| **CRUD** | Create/read/update/delete via Control API | `ControlBaseCommand` | Control API (HTTP) | `integrations create`, `queues delete` |

**Specialized base classes** — some command groups have dedicated base classes that handle common setup (client lifecycle, cleanup, shared flags):

| Pattern | Base class | When to use | Source |
|---------|-----------|-------------|--------|
| Chat commands | `ChatBaseCommand` | `rooms messages`, `rooms reactions`, `rooms typing`, `rooms occupancy` | `src/chat-base-command.ts` |
| Spaces commands | `SpacesBaseCommand` | `spaces members`, `spaces locks`, `spaces cursors`, `spaces locations` | `src/spaces-base-command.ts` |
| Stats commands | `StatsBaseCommand` | `stats app`, `stats account` | `src/stats-base-command.ts` |

If your command falls into one of these groups, extend the specialized base class instead of `AblyBaseCommand` or `ControlBaseCommand` directly. **Exception:** if your command only needs a REST client (e.g., history queries that don't enter a space or join a room), you may use `AblyBaseCommand` directly — the specialized base class is most valuable when the command needs realtime connections, cleanup lifecycle, or shared setup like `room.attach()` / `space.enter()`.

### When to call `room.attach()` / `space.enter()`

**Not every Chat/Spaces command needs `room.attach()` or `space.enter()`.** Before adding attachment, check whether the SDK method you're calling requires an active realtime connection or is a pure REST call:

| Needs `room.attach()` | Does NOT need `room.attach()` |
|------------------------|-------------------------------|
| Subscribe (realtime listener) | Send (REST via `chatApi.sendMessage`) |
| Presence enter/get/update/leave | Update (REST via `chatApi.updateMessage`) |
| Occupancy subscribe | Delete (REST via `chatApi.deleteMessage`) |
| Typing keystroke/stop | Annotate/append (REST mutation) |
| Reactions send (realtime publish) | History queries (REST via `chatApi.history`) |
| Reactions subscribe | Occupancy get (REST via `chatApi.getOccupancy`) |

**How it works in the SDK:** Methods that go through `this._chatApi.*` are REST calls and don't need attachment. Methods that use `this._channel.publish()`, `this._channel.presence.*`, or subscribe to channel events require the realtime channel to be attached. Room-level reactions use `this._channel.publish()` (realtime), but messages send/update/delete use `this._chatApi.*` (REST).

**Rule of thumb:** If the SDK method is a one-shot REST call (returns a Promise with a result, no callback/listener), you do NOT need `room.attach()`. Just call `chatClient.rooms.get(roomId)` to get the room handle and invoke the method directly. Attaching unnecessarily adds latency and creates a realtime connection that isn't needed.

**How to verify:** Check the Chat SDK source or typedoc — methods that are REST-based don't require the room to be in an `attached` state. When in doubt, test without `room.attach()` — if the SDK method works, attachment isn't needed.

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
import { formatResource, formatSuccess, formatProgress, formatListening, formatTimestamp, formatClientId, formatEventType, formatLabel, formatHeading, formatIndex } from "../../utils/output.js";
```

**Control API commands** (apps, integrations, queues, keys, rules, push config):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatResource, formatSuccess, formatLabel, formatHeading } from "../../utils/output.js";
```

**Chat commands** (rooms messages, reactions, typing, occupancy):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../chat-base-command.js";
import { productApiFlags, clientIdFlag } from "../../flags.js";
import { formatResource, formatSuccess, formatProgress, formatListening } from "../../utils/output.js";
```

**Spaces commands** (spaces members, locks, cursors, locations):
```typescript
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { SpacesBaseCommand } from "../../spaces-base-command.js";
import { productApiFlags, clientIdFlag } from "../../flags.js";
import { formatResource, formatSuccess, formatProgress, formatListening, formatClientId } from "../../utils/output.js";
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

**Control API helper methods:**
- `await this.requireAppId(flags)` — resolves and validates the app ID, returns `Promise<string>` (non-nullable). Calls `this.fail()` internally if no app found — no manual null check needed.
- `await this.runControlCommand(flags, api => api.method(appId))` — creates the Control API client, executes the call, and handles errors in one step. Returns `Promise<T>` (non-nullable). Useful for single API calls; for multi-step flows, use `this.createControlApi(flags)` directly.

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
  this.log(formatProgress("Attaching to channel: " + formatResource(channelName)));
}

// After success:
if (!this.shouldOutputJson(flags)) {
  this.log(formatSuccess("Subscribed to channel: " + formatResource(channelName) + "."));
  this.log(formatListening("Listening for messages."));
}

// JSON output — use logJsonResult for one-shot results:
if (this.shouldOutputJson(flags)) {
  this.logJsonResult({ channel: args.channel, message }, flags);
}

// Streaming events — use logJsonEvent:
if (this.shouldOutputJson(flags)) {
  this.logJsonEvent({ eventType: event.type, message, channel: channelName }, flags);
}
```

**Output helper reference** — all exported from `src/utils/output.ts`:

| Helper | Usage | Example |
|--------|-------|---------|
| `formatProgress(msg)` | Action in progress — appends `...` automatically | `formatProgress("Attaching to channel")` |
| `formatSuccess(msg)` | Green checkmark — always end with `.` (period, not `!`) | `formatSuccess("Subscribed to channel " + formatResource(name) + ".")` |
| `formatWarning(msg)` | Yellow `⚠` — for non-fatal warnings. Don't prefix with "Warning:" | `formatWarning("Persistence is automatically enabled.")` |
| `formatListening(msg)` | Dim text — auto-appends "Press Ctrl+C to exit." | `formatListening("Listening for messages.")` |
| `formatResource(name)` | Cyan — for resource names, never use quotes | `formatResource(channelName)` |
| `formatTimestamp(ts)` | Dim `[timestamp]` — for event streams | `formatTimestamp(isoString)` |
| `formatMessageTimestamp(ts)` | Converts Ably message timestamp to ISO string | `formatMessageTimestamp(message.timestamp)` |
| `formatCountLabel(n, singular, plural?)` | Cyan count + pluralized label | `formatCountLabel(3, "message")` → "3 messages" |
| `formatLimitWarning(count, limit, name)` | Yellow warning if results truncated, null otherwise | `formatLimitWarning(items.length, flags.limit, "items")` |
| `formatPresenceAction(action)` | Returns `{ symbol, color }` for enter/leave/update | `formatPresenceAction("enter")` → `{ symbol: "✓", color: chalk.green }` |
| `formatClientId(id)` | Blue — for client identity display | `formatClientId(msg.clientId)` |
| `formatEventType(type)` | Yellow — for event/action type labels | `formatEventType("enter")` |
| `formatLabel(text)` | Dim with colon — for field labels in structured output | `formatLabel("Platform")` → dim "Platform:" |
| `formatHeading(text)` | Bold — for record headings in list output | `formatHeading("Device ID: " + id)` |
| `formatIndex(n)` | Dim bracketed number — for history ordering | `formatIndex(1)` → dim "[1]" |

Rules:
- `formatProgress("Action text")` — appends `...` automatically, never add it manually
- `formatSuccess("Completed action.")` — green checkmark, always end with `.` (period, not `!`)
- `formatListening("Listening for X.")` — dim text, automatically appends "Press Ctrl+C to exit."
- `formatResource(name)` — cyan colored, never use quotes around resource names. **Exception:** do not use `formatResource()` or any ANSI-producing helper inside `this.fail()` message strings — `fail()` passes the message into the JSON error envelope, where ANSI codes would corrupt the output. Use plain quoted strings in error messages instead.
- `formatTimestamp(ts)` — dim `[timestamp]` for event streams
- `formatClientId(id)` — blue, for client identity in events
- `formatEventType(type)` — yellow, for event/action labels
- `formatLabel(text)` — dim with colon, for field labels
- `formatHeading(text)` — bold, for record headings in lists
- `formatIndex(n)` — dim bracketed number, for history ordering
- Use `this.fail()` for all errors (see Error handling below), never `this.log(chalk.red(...))`
- Never use `console.log` or `console.error` — always `this.log()` or `this.logToStderr()`

### JSON envelope — reserved keys

`logJsonResult(data, flags)` and `logJsonEvent(data, flags)` are shorthand for `this.log(this.formatJsonRecord("result"|"event", data, flags))`. The envelope wraps data in `{type, command, success?, ...data}` and **silently strips** these reserved keys from your data to prevent collisions:
- `type` — always stripped (envelope's own `type` field)
- `command` — always stripped (envelope's own `command` field)
- `success` — stripped from `"error"` records (always `false`); for `"result"` records, data's `success` **overrides** the envelope's default `true`

**Pitfall:** If your event data has a `type` field (e.g., from an SDK event object), it will be silently dropped. Use a different key name:
```typescript
// WRONG — event.type is silently stripped by the envelope
this.logJsonEvent({ type: event.type, message, room }, flags);

// CORRECT — use "eventType" to avoid collision with envelope's "type"
this.logJsonEvent({ eventType: event.type, message, room }, flags);
```

Similarly, for batch results with a success/failure summary, don't use `success` as the key — it collides with the envelope's `success: true`:
```typescript
// WRONG — data's "success" overrides envelope's "success"
this.logJsonResult({ success: errors === 0, published, errors }, flags);

// CORRECT — use "allSucceeded" for the batch summary
this.logJsonResult({ allSucceeded: errors === 0, published, errors }, flags);
```

### Error handling

Choose the right mechanism based on intent:

| Intent | Method | Behavior |
|--------|--------|----------|
| **Stop the command** (fatal error) | `this.fail(error, flags, component)` | Logs event, emits JSON error envelope if `--json`, exits. Returns `never` — execution stops, no `return;` needed. |
| **Warn and continue** (non-fatal) | `this.warn()` or `this.logToStderr()` | Prints warning, execution continues normally. |
| **Reject inside Promise callbacks** | `reject(new Error(...))` | Propagates to `await`, where the catch block calls `this.fail()`. |

All fatal errors flow through `this.fail()`, which uses `CommandError` (`src/errors/command-error.ts`) to preserve Ably error codes and HTTP status codes:

```
this.fail(): never   ← the single funnel (logs event, emits JSON, exits)
    ↓ internally calls
this.error()         ← oclif exit (ONLY inside fail, nowhere else)
```

**In command `run()` methods**, use `this.fail()` for all errors. It always exits — returns `never`, so no `return;` is needed after calling it. It logs the CLI event, preserves structured error data, emits JSON error envelope when `--json` is active, and calls `this.error()` for human-readable output. It accepts an `Error` object or a plain string message.

**Component name casing:** All component strings use **camelCase** — both in `this.fail()` and `logCliEvent()`. Single-word components are plain lowercase (`"room"`, `"auth"`). Multi-word components use camelCase (`"channelPublish"`, `"roomPresenceSubscribe"`). This matches CLI conventions for log tags and keeps output like `[channelPublish] Error: ...` readable.

```typescript
// In catch blocks — pass the error object
try {
  // All fallible calls go inside try-catch, including base class methods
  // like createControlApi, createAblyRealtimeClient, etc.
  const controlApi = this.createControlApi(flags);
  const result = await controlApi.someMethod(appId, data);
  // ...
} catch (error) {
  this.fail(
    error,
    flags,
    "channelPublish",     // camelCase — e.g., "channelPublish", "presenceEnter"
    { channel: args.channel },  // optional context for logging
  );
}

// logCliEvent uses the same camelCase convention
this.logCliEvent(flags, "room", "attaching", `Attaching to room ${roomName}`);
this.logCliEvent(flags, "presence", "subscribed", "Subscribed to presence events");

// For validation / early exit — pass a string message (no return; needed)
if (!appId) {
  this.fail(
    'No app specified. Use --app flag or select an app with "ably apps switch"',
    flags,
    "app",
  );
}
```

**In base class utility methods** (e.g., `createControlApi`, `createAblyRealtimeClient`, `parseJsonFlag`), use `this.fail()` for fatal errors — the same pattern as in command `run()` methods. The `fail()` method returns `never`, so TypeScript knows execution stops and won't require a return value after the call.

**Do NOT use `this.error()` directly** — it is an internal implementation detail of `fail`. Calling `this.error()` directly skips event logging and doesn't respect `--json` mode.

**Safe to use `this.fail()` in both try and catch** — `this.fail()` automatically detects if the error was already processed by a prior `this.fail()` call (by checking for the `oclif` property) and re-throws it instead of double-processing. This means you can freely call `this.fail()` for validation inside a `try` block without worrying about the `catch` block calling `this.fail()` again.

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
pnpm prepare        # Build + update manifest
pnpm exec oclif readme  # Regenerate README.md from command metadata
pnpm exec eslint .  # Lint (must be 0 errors)
pnpm test:unit      # Run tests
```

## Maintaining this skill

This skill is the **source of truth** for command conventions. The review skills (`ably-review`, `ably-codebase-review`) and `CLAUDE.md` reference the same patterns. If you change conventions here — or if the underlying source code changes (base classes, helpers, flags, error handling) — update all three locations:
1. **This file** (`SKILL.md`) and its `references/` templates
2. **`ably-review/SKILL.md`** and **`ably-codebase-review/SKILL.md`** — review checks must match current patterns
3. **`.claude/CLAUDE.md`** — project-level docs that all agents see

See the "Keeping Skills Up to Date" section in `CLAUDE.md` for the full list of triggers.

## Checklist

- [ ] Command file at correct path under `src/commands/`
- [ ] Correct base class (`AblyBaseCommand`, `ControlBaseCommand`, `ChatBaseCommand`, `SpacesBaseCommand`, or `StatsBaseCommand`)
- [ ] Correct flag set (`productApiFlags` vs `ControlBaseCommand.globalFlags`)
- [ ] `clientIdFlag` only if command needs client identity
- [ ] All human output wrapped in `if (!this.shouldOutputJson(flags))`
- [ ] Output helpers used correctly (`formatProgress`, `formatSuccess`, `formatWarning`, `formatListening`, `formatResource`, `formatTimestamp`, `formatClientId`, `formatEventType`, `formatLabel`, `formatHeading`, `formatIndex`)
- [ ] `formatSuccess()` messages end with `.` (period)
- [ ] Resource names use `formatResource(name)`, never quoted
- [ ] JSON output uses `logJsonResult()` (one-shot) or `logJsonEvent()` (streaming), not direct `formatJsonRecord()`
- [ ] `room.attach()` / `space.enter()` only called when the SDK method requires a realtime connection (subscribe, send, presence) — NOT for REST mutations (update, delete, annotate, history)
- [ ] Subscribe/enter commands use `this.waitAndTrackCleanup(flags, component, flags.duration)` (not `waitUntilInterruptedOrTimeout`)
- [ ] Error handling uses `this.fail()` exclusively, not `this.error()` or `this.log(chalk.red(...))`
- [ ] Component strings are camelCase: single-word lowercase (`"room"`, `"auth"`), multi-word camelCase (`"channelPublish"`, `"roomPresenceSubscribe"`)
- [ ] At least one `--json` example in `static examples`
- [ ] Test file at matching path under `test/unit/commands/`
- [ ] Tests use correct mock helper (`getMockAblyRealtime`, `getMockAblyRest`, `nock`)
- [ ] Tests don't pass auth flags — `MockConfigManager` handles auth
- [ ] Subscribe tests auto-exit via env var (ABLY_CLI_DEFAULT_DURATION: "0.25" in vitest.config.ts) — do NOT pass --duration to runCommand()
- [ ] Tests use `standardHelpTests()`, `standardArgValidationTests()`, `standardFlagTests()` from `test/helpers/standard-tests.ts`
- [ ] Control API tests use `nockControl()`, `controlApiCleanup()` from `test/helpers/control-api-test-helpers.ts`
- [ ] Control API tests use `standardControlApiErrorTests()` for 401/500/network error tests in the `describe("error handling", ...)` block
- [ ] Control API response bodies use `mockApp()`, `mockKey()`, `mockRule()`, `mockQueue()`, `mockNamespace()`, `mockStats()` from `test/fixtures/control-api.ts` where applicable
- [ ] Index file created if new topic/subtopic
- [ ] `pnpm prepare && pnpm exec eslint . && pnpm test:unit` passes
