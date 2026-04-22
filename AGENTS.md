# AGENTS.md - Ably CLI

## Mandatory Workflow

**Run these IN ORDER for EVERY change:**

```bash
pnpm prepare        # 1. Build + update manifest
pnpm generate-doc  # 2. Regenerate docs (gitignored)
pnpm exec eslint .  # 3. Lint (MUST be 0 errors)
pnpm test:unit      # 4. Test (at minimum)
pnpm test:tty       # 5. TTY tests (local only, skip in CI)
                    # 6. Update docs if needed
```

**If you skip these steps, the work is NOT complete.**

## Project Context

This is the Ably CLI npm package (`@ably/cli`), built with the [oclif framework](https://oclif.io/).

```
.
├── src/
│   ├── commands/      # CLI commands (oclif)
│   ├── services/      # Business logic
│   ├── utils/         # Utilities
│   └── base-command.ts
├── test/
│   ├── unit/          # Fast, mocked
│   ├── integration/   # Multi-component, mocked external services
│   ├── e2e/           # Full scenarios against real Ably
│   └── helpers/       # runCommand(), MockConfigManager, etc.
├── docs/              # Project docs (Testing.md, Project-Structure.md, etc.)
└── package.json       # Scripts defined here
```

## Common Pitfalls - DO NOT DO THESE

1. **Skip tests** - Only skip with documented valid reason
2. **Use `_` prefix for unused variables** - Remove the code instead
3. **Leave debug code** - Remove ALL console.log, DEBUG_TEST, test-*.mjs
4. **Use `// eslint-disable`** - Fix the root cause
5. **Remove tests without asking** - Always get permission first
6. **NODE_ENV** - To check if the CLI is in test mode, use the `isTestMode()` helper function.
7. **`process.exit`** - When creating a command, use `this.exit()` for consistent test mode handling.
8. **`console.log` / `console.error`** - In commands, always use `this.log()` (stdout) for data/results and the logging helpers (`this.logProgress()`, `this.logSuccessMessage()`, `this.logListening()`, `this.logHolding()`, `this.logWarning()`) for status messages. `console.*` bypasses oclif and can't be captured by tests.

## Correct Practices

### When Tests Fail
```typescript
// WRONG
it.skip('test name', () => {

// CORRECT - Document why
it.skip('should handle Ctrl+C on empty prompt', function(done) {
  // SKIPPED: This test is flaky in non-TTY environments
  // The readline SIGINT handler doesn't work properly with piped stdio
```

### When Linting Fails
```typescript
// WRONG - Workaround
let _unusedVar = getValue();

// CORRECT - Remove unused code
// Delete the line entirely
```

### Debug Cleanup Checklist
```bash
# After debugging, ALWAYS check:
find . -name "test-*.mjs" -type f
grep -r "DEBUG_TEST" src/ test/
grep -r "console.log" src/  # Except legitimate output
```

## Quick Reference

```bash
# Full validation
pnpm validate

# Run specific test
pnpm test test/unit/commands/interactive.test.ts

# Lint specific file
pnpm exec eslint src/commands/interactive.ts

# Dev mode
pnpm dev
```

## Flag Architecture

Flags are NOT global. Each command explicitly declares only the flags it needs via composable flag sets defined in `src/flags.ts`:

- **`coreGlobalFlags`** — `--verbose`, `--json`, `--pretty-json`, `--web-cli-help` (hidden) (on every command via `AblyBaseCommand.globalFlags`)
- **`productApiFlags`** — core + hidden product API flags (`port`, `tlsPort`, `tls`). Use for commands that talk to the Ably product API.
- **`controlApiFlags`** — core + hidden control API flags (`control-host`, `dashboard-host`). Use for commands that talk to the Control API.
- **`clientIdFlag`** — `--client-id`. Add to commands where client identity affects the operation: subscribe, publish, enter, set, acquire, update, delete, append. Do NOT add to read-only queries (get, get-all, occupancy get) — Ably capabilities are operation-based, not clientId-based, so client identity is irrelevant for pure reads. Do NOT add globally.
- **`durationFlag`** — `--duration` / `-D`. Use for long-running subscribe/stream commands that auto-exit after N seconds.
- **`rewindFlag`** — `--rewind`. Use for subscribe commands that support message replay (default: 0).
- **`timeRangeFlags`** — `--start`, `--end`. Use for history and stats commands. Parse with `parseTimestamp()` from `src/utils/time.ts`. Accepts ISO 8601, Unix ms, or relative (e.g., `"1h"`, `"30m"`, `"2d"`).
- **`forceFlag`** — `--force` / `-f`. Use for destructive commands (delete, revoke) that require user confirmation. When `--force` is provided, skip the interactive prompt. When `--json` is used without `--force`, fail with an error requiring `--force`. Use `promptForConfirmation()` from `src/utils/prompt-confirmation.js` for the interactive prompt — do NOT use `interactiveHelper.confirm()` (inquirer-based, inconsistent UX).
- **`endpointFlag`** — `--endpoint`. Hidden, only on `accounts login` and `accounts switch`.

**When creating a new command:**
```typescript
// Product API command (channels, spaces, rooms, etc.)
import { productApiFlags, clientIdFlag, durationFlag, rewindFlag } from "../../flags.js";
static override flags = {
  ...productApiFlags,
  ...clientIdFlag,  // Only if command needs client identity
  ...durationFlag,  // Only if long-running (subscribe/stream commands)
  ...rewindFlag,    // Only if supports message replay
  // command-specific flags...
};

// Control API command (apps, keys, queues, etc.)
// controlApiFlags come from ControlBaseCommand.globalFlags automatically
static flags = {
  ...ControlBaseCommand.globalFlags,
  // command-specific flags...
};
```

**Auth** is managed via `ably login` (stored config). Environment variables override stored config for CI, scripting, or testing:
- `ABLY_API_KEY`, `ABLY_TOKEN`, `ABLY_ACCESS_TOKEN`

Do NOT add `--api-key`, `--token`, or `--access-token` flags to commands.

## Writing Tests

**Auth in tests — do NOT use CLI flags (`--api-key`, `--token`, `--access-token`):**
**Unit tests** — Auth is provided automatically by `MockConfigManager` (see `test/helpers/mock-config-manager.ts`). No env vars needed. Only set `ABLY_API_KEY` when specifically testing env var override behavior.
```typescript
// WRONG — don't pass auth flags
runCommand(["channels", "publish", "my-channel", "hello", "--api-key", key]);

// CORRECT — MockConfigManager provides auth automatically
runCommand(["channels", "publish", "my-channel", "hello"]);

// CORRECT — use getMockConfigManager() to access test auth values
import { getMockConfigManager } from "../../helpers/mock-config-manager.js";
const mockConfig = getMockConfigManager();
const apiKey = mockConfig.getApiKey()!;
const appId = mockConfig.getCurrentAppId()!;
```

**E2E tests** — Commands run as real subprocesses, so auth must be passed via env vars:
```typescript
// CORRECT — pass auth via env vars for E2E
runCommand(["channels", "publish", "my-channel", "hello"], {
  env: { ABLY_API_KEY: key },
});

// CORRECT — spawn with env vars
spawn("node", [cliPath, "channels", "subscribe", "my-channel"], {
  env: { ...process.env, ABLY_API_KEY: key },
});

// Control API commands use ABLY_ACCESS_TOKEN
runCommand(["stats", "account"], {
  env: { ABLY_ACCESS_TOKEN: token },
});
```

**Duration in tests — do NOT use `--duration` in unit/integration tests:**
Unit and integration tests set `ABLY_CLI_DEFAULT_DURATION: "0.25"` in `vitest.config.ts`, which makes all subscribe/long-running commands auto-exit after 250ms. Do NOT pass `--duration` to `runCommand()` — it overrides the fast 250ms default with a slower explicit value.

Exceptions:
- `test:wait` command tests — `--duration` is a required flag for that command
- `interactive-sigint.test.ts` — needs a longer duration for SIGINT testing
- Help output checks — testing that `--help` mentions `--duration` is fine

See [`docs/Testing.md`](../docs/Testing.md) for test layers, directory layout, required describe blocks, running tests, helpers reference, and conventions.

## CLI Output & Flag Conventions

### Output patterns (use helpers from src/utils/output.ts)

All output helpers use the `format` prefix and are exported from `src/utils/output.ts`:

- **Progress**: `this.logProgress("Attaching to channel: " + formatResource(name), flags)` — no color on action text, appends `...` automatically. Silent in JSON mode (structured events convey the same info). Never manually write `"Doing something..."` — always use `logProgress`.
- **Success**: `this.logSuccessMessage("Message published to channel " + formatResource(name) + ".", flags)` — green checkmark, **must** end with `.` (not `!`). Silent in JSON mode (the result record's `success: true` already conveys this). Never use `chalk.green(...)` directly — always use `logSuccessMessage`. Place inside `else` block after `logJsonResult`.
- **Warnings**: `this.logWarning("Message text here.", flags)` — yellow `⚠` symbol. Emits structured JSON in JSON mode (agents need actionable warnings). Never use `chalk.yellow("Warning: ...")` directly — always use `logWarning`. Don't include "Warning:" prefix in the message — the symbol conveys it.
- **Listening**: `this.logListening("Listening for messages.", flags)` — dim, includes "Press Ctrl+C to exit." Emits `status: "listening"` in JSON mode. Use for passive subscribe/stream commands. Don't combine listening text inside a `logSuccessMessage()` call.
- **Holding**: `this.logHolding("Holding presence. Press Ctrl+C to exit.", flags)` — same visual as listening for humans. Emits `status: "holding"` in JSON mode. Use for commands that hold state (enter, set, acquire).
- **Resource names**: Always `formatResource(name)` (cyan), never quoted — including in `logCliEvent` messages.
- **Timestamps**: `formatTimestamp(ts)` — dim `[timestamp]` for event streams. `formatMessageTimestamp(message.timestamp)` — converts Ably message timestamp (number|undefined) to ISO string.
- **Labels**: `formatLabel("Field Name")` — dim with colon appended, for field names in structured output.
- **Client IDs**: `formatClientId(id)` — blue, for user/client identifiers in events.
- **Event types**: `formatEventType(type)` — yellow, for action/event type labels.
- **Headings**: `formatHeading("Record ID: " + id)` — bold, for record headings in list output.
- **Index**: `formatIndex(n)` — dim bracketed number `[n]`, for history/list ordering.
- **Count labels**: `formatCountLabel(n, "message")` — cyan count + pluralized label.
- **Limit warnings**: `formatLimitWarning(count, limit, "items")` — yellow warning if results truncated. Only show when `hasMore === true`.
- **Pagination collection**: `collectPaginatedResults(firstPage, limit)` — walks cursor-based pages until `limit` items are collected. Returns `{ items, hasMore, pagesConsumed }`. Use for both SDK and HTTP paginated commands.
- **Filtered pagination**: `collectFilteredPaginatedResults(firstPage, limit, filter, maxPages?)` — same as above but applies a client-side filter. Use for rooms/spaces list where channels need prefix filtering. `maxPages` (default: 20) prevents runaway requests.
- **Pagination warning**: `formatPaginationLog(pagesConsumed, itemCount, isBillable?)` — shows "Fetched N pages" when `pagesConsumed > 1`. Pass `isBillable: true` for history commands (each message retrieved counts as a billable message). Guard with `!this.shouldOutputJson(flags)`.
- **Pagination next hint**: `buildPaginationNext(hasMore, lastTimestamp?)` — returns `{ hint, start? }` for JSON output when `hasMore` is true. Pass `lastTimestamp` only for history commands (which have `--start`).
- **Logging helpers**: The base command provides five helpers: `this.logProgress(msg, flags)`, `this.logSuccessMessage(msg, flags)`, `this.logListening(msg, flags)`, `this.logHolding(msg, flags)`, `this.logWarning(msg, flags)`. These do NOT need `shouldOutputJson` guards. In non-JSON mode they all emit formatted text on stderr. In JSON mode: `logProgress` and `logSuccessMessage` are **silent** (no-ops), while `logListening`, `logHolding`, and `logWarning` emit structured JSON on stdout. `logSuccessMessage` should be inside the `else` block after `logJsonResult` for readability. Only human-readable **data output** (field labels, headings, record blocks) still needs the `if/else` pattern with `shouldOutputJson` to switch between JSON and human-readable formats. `formatPaginationLog()` output still uses `this.logToStderr(paginationWarning)` directly (not a helper yet).
- **JSON envelope**: Use `this.logJsonResult(data, flags)` for one-shot results, `this.logJsonEvent(data, flags)` for streaming events, and `this.logJsonStatus(status, message, flags)` for hold/status signals in long-running commands. The envelope adds top-level fields (`type`, `command`, `success?`). Nest domain data under a **domain key** (see "JSON data nesting convention" below). Do NOT add ad-hoc `success: true/false` — the envelope handles it. `--json` produces compact single-line output (NDJSON for streaming). `--pretty-json` is unchanged.
- **JSON hold status**: Long-running hold commands (e.g. `spaces members enter`, `spaces locations set`, `spaces locks acquire`, `spaces cursors set`) must call `this.logHolding("Holding <thing>. Press Ctrl+C to exit.", flags)` after the result. This emits `status: "holding"` in JSON mode, telling agents the command is alive and waiting. For passive subscribe commands, use `this.logListening(...)` instead (emits `status: "listening"`).
- **JSON completed signal**: Every command automatically emits a `{"type":"status","status":"completed","exitCode":0|1}` line as the very last JSON output when the command finishes. This is emitted in `finally()` in `AblyBaseCommand` — commands do NOT need to emit it manually. It tells LLM agents and scripts that the command is finished and there will be no more output. Exit code 0 = success, 1 = error. The completed signal respects `--pretty-json`.
- **JSON errors**: Use `this.fail(error, flags, component, context?)` as the single error funnel in command `run()` methods. It logs the CLI event, preserves structured error data (Ably codes, HTTP status), emits JSON error envelope when `--json` is active, and calls `this.error()` for human-readable output. Returns `never` — no `return;` needed after calling it. Do NOT call `this.error()` directly — it is an internal implementation detail of `fail`. The JSON error envelope nests error details under an `error` object: `{ error: { message, code?, statusCode?, hint? }, ...context }`.
- **Inline error extraction**: For commands that report per-item errors inline (e.g., batch publish, connections test), use `extractErrorInfo(error)` from `src/utils/errors.ts` to produce a structured `{ message, code?, statusCode?, href? }` object. This is for embedding error data in result objects — not for fatal errors (use `this.fail()` for those).
- **History output**: Use `[index] [timestamp]` on the same line as a heading: `` `${formatIndex(index + 1)} ${formatTimestamp(timestamp)}` ``, then fields indented below. This is distinct from **get-all output** which uses `[index]` alone on its own line. See `references/patterns.md` "History results" and "One-shot results" for both patterns.

### Structured output format (non-JSON)

All non-JSON output for data records must use **multi-line labeled blocks** — one block per record, separated by blank lines. Never use ASCII tables (`┌─┬─┐`, `│`, box-drawing characters) or custom grid layouts. Non-JSON output must expose the same fields as JSON output (omit only null/undefined/empty values). Use `formatLabel()` for field names, type-appropriate formatters for values (`formatClientId`, `formatResource`, `formatEventType`, `formatTimestamp`). Check SDK type definitions (see "Ably Knowledge" below) as the source of truth for available fields — import SDK types directly, never redefine them locally. See `references/patterns.md` "Human-Readable Output Format" in the `ably-new-command` skill for detailed examples.

### JSON data nesting convention

The envelope provides three top-level fields: `type`, `command`, and `success`. All domain data must be nested under a **domain key** — never spread raw data fields at the top level alongside envelope fields.

- **Events and single results**: nest under a **singular** domain key (`message`, `cursor`, `lock`)
- **Collection results**: nest under a **plural** domain key (`cursors`, `rules`, `keys`)
- **Metadata** (`total`, `timestamp`, `hasMore`, `appId`) may sit alongside the domain key

See `references/patterns.md` "JSON Data Nesting Convention" in the `ably-new-command` skill for detailed examples and domain key naming.

### Command behavior semantics

Each command type has strict rules about what side effects it may have. Remove unintended side effects (e.g., auto-entering presence) and support passive ("dumb") operations where applicable. Key principles:
- **Subscribe** = passive observer (no `space.enter()`, no fetching initial state)
- **Get-all / get** = one-shot query (no `space.enter()`, no subscribing)
- **Set / enter / acquire** = hold state until Ctrl+C / `--duration` (enter, operate, hold — no subscribing after)
- Call `space.enter()` only when SDK requires it; always call `this.markAsEntered()` after
- Hold commands use manual entry (`enterSpace: false` + `space.enter()` + `markAsEntered()`) for consistency
- **Room success messages**: Only use `successMessage` in `setupRoomStatusHandler` when the subscribe call is **before** `room.attach()`. Otherwise, print success/listening manually **after** the subscribe/action. Never say "Connected to room" — use action-specific wording.

See `references/patterns.md` "Command behavior semantics" in the `ably-new-command` skill for full rules, side-effect table, and code examples.

### Error handling architecture

Choose the right mechanism based on intent:

| Intent | Method | Behavior |
|--------|--------|----------|
| **Stop the command** (fatal error) | `this.fail(error, flags, component)` | Logs event, emits JSON error envelope if `--json`, exits. Returns `never` — execution stops, no `return;` needed. |
| **Warn and continue** (non-fatal) | `this.warn()` or `this.logToStderr()` | Prints warning, execution continues normally. |
| **Reject inside Promise callbacks** | `reject(new Error(...))` | Propagates to `await`, where the catch block calls `this.fail()`. |

All fatal errors flow through `this.fail()` (`src/base-command.ts`), which uses `CommandError` (`src/errors/command-error.ts`) to preserve Ably error codes and HTTP status codes:

```
this.fail(): never   ← the single funnel (logs event, emits JSON, exits)
    ↓ internally calls
this.error()         ← oclif exit (ONLY inside fail, nowhere else)
```

- **`this.fail()` always exits** — it returns `never`. TypeScript enforces no code runs after it. This eliminates the "forgotten `return;`" bug class.
- **Component strings are camelCase** — both in `this.fail()` and `logCliEvent()`. Single-word: `"room"`, `"auth"`. Multi-word: `"channelPublish"`, `"roomPresenceSubscribe"`. These appear in verbose log output as `[component]` tags and in JSON envelopes.
- **In command `run()` methods**: Use `this.fail()` for all errors. Wrap fallible calls in try-catch blocks.
- **Base class methods with `flags`** (`createControlApi`, `createAblyRealtimeClient`, `requireAppId`, `runControlCommand`, etc.) also use `this.fail()` directly. Methods without `flags` pass `{}` as a fallback.
- **`reject(new Error(...))`** inside Promise callbacks (e.g., connection event handlers) is the one pattern that can't use `this.fail()` — the rejection propagates to `await`, where the command's catch block calls `this.fail()`.
- **Never use `this.error()` directly** — it is an internal implementation detail of `this.fail()`.
- **`requireAppId`** returns `Promise<string>` (not nullable) — calls `this.fail()` internally if no app found.
- **`runControlCommand<T>`** returns `Promise<T>` (not nullable) — calls `this.fail()` internally on error.
- **Error hints**: `fail()` appends a CLI-specific hint from `src/utils/errors.ts` if one exists for the Ably error code. Hints must only contain actionable CLI advice (e.g., "run `ably login`"), not restate the upstream error message (which is already shown). When adding new error codes, **fetch** https://ably.com/docs/platform/errors/codes using WebFetch to get the official description — do NOT rely on memory or assumptions about what an error code means.
- **`extractErrorInfo(error)`** (`src/utils/errors.ts`) — extracts `{ message, code?, statusCode?, href? }` from an unknown error value. Use in commands that report per-item errors inline (batch publish results, connection test summaries) rather than exiting via `this.fail()`.

### Additional output patterns (direct chalk, not helpers)
- **No app error**: `'No app specified. Use --app flag or select an app with "ably apps switch"'`

### Help output theme
Help colors are configured via `package.json > oclif.theme` (oclif's built-in theme system). The custom help class in `src/help.ts` also applies colors to COMMANDS sections it builds manually. Color scheme:
- **Commands/bin/topics**: cyan — primary actionable items
- **Flags/args**: whiteBright — bright but secondary to commands
- **Section headers**: bold — USAGE, FLAGS, COMMANDS, etc.
- **Command summaries**: whiteBright — descriptions in command listings
- **Defaults/options**: yellow — `[default: N]`, `<options: ...>`
- **Required flags**: red — `(required)` marker
- **`$` prompt**: green — shell prompt in examples/usage
- **Flag separator**: dim — comma between `-c, --count`

When adding COMMANDS sections in `src/help.ts`, use `chalk.bold()` for headers, `chalk.cyan()` for command names, and `chalk.whiteBright()` for descriptions to stay consistent.

### Flag conventions
- All flags kebab-case: `--my-flag` (never camelCase)
- **No duplicate defaults in descriptions**: oclif appends `[default: N]` to `--help` automatically. Don't repeat it in `description`. Exceptions: falsy defaults (`0`, `false`) — oclif suppresses these, so keep them in the description. Behavioral phrases like `"defaults to current app"` are fine too.
- `--app`: `"The app ID or name (defaults to current app)"` (for commands with `resolveAppId`), `"The app ID (defaults to current app)"` (for commands without)
- `--limit`: `"Maximum number of results to return"` with `min: 1`
- `--duration`: Use `durationFlag` from `src/flags.ts`. `"Automatically exit after N seconds"`, alias `-D`.
- `--rewind`: Use `rewindFlag` from `src/flags.ts`. `"Number of messages to rewind when subscribing (default: 0)"`. Apply with `this.configureRewind(channelOptions, flags.rewind, flags, component, channelName)`.
- `--start`/`--end`: Use `timeRangeFlags` from `src/flags.ts` and parse with `parseTimestamp()` from `src/utils/time.ts`. Accepts ISO 8601, Unix ms, or relative (e.g., `"1h"`, `"30m"`, `"2d"`).
- `--direction`: `"Direction of message retrieval"` or `"Direction of log retrieval"`, options `["backwards", "forwards"]`.
- Channels use "publish", Rooms use "send" (matches SDK terminology)
- Command descriptions: imperative mood, sentence case, no trailing period (e.g., `"Subscribe to presence events on a channel"`)
- **Destructive command confirmation pattern**: Commands that perform irreversible actions (delete, revoke) must use `...forceFlag` and `promptForConfirmation()`. The pattern:
  1. If `--json` without `--force`: `this.fail("The --force flag is required when using --json to confirm <action>", flags, component)`
  2. If no `--force` and not JSON: show what will be affected, then call `promptForConfirmation()` for yes/no
  3. If `--force`: skip prompt, proceed directly

## Ably Knowledge

- When in doubt about how Ably works, refer to the Ably docs at https://ably.com/docs.
- Key docs:
  - Pub/Sub: https://ably.com/docs/basics and API ref at https://ably.com/docs/api/realtime-sdk (use https://ably.com/docs/sdk/js/v2.0/ when referenced)
  - Chat: https://ably.com/docs/chat and API ref at https://sdk.ably.com/builds/ably/ably-chat-js/main/typedoc/modules/chat-js.html
  - Spaces: https://ably.com/docs/spaces and API ref at https://sdk.ably.com/builds/ably/spaces/main/typedoc/index.html
  - Control API: https://ably.com/docs/account/control-api and ref at https://ably.com/docs/api/control-api
  - Platform: https://ably.com/docs/platform
- The CLI uses Ably SDKs for all data plane commands. When an API exists in the data plane REST API but has no corresponding SDK method, use the Pub/Sub SDK's request method.
- The Control API has no official SDK, so raw HTTP requests are used.
- **SDK packages (`node_modules/ably/`, `node_modules/@ably/spaces/`, `node_modules/@ably/chat/`) are the local source of truth** for types and method behavior. Type definitions (e.g., `ably.d.ts`, `types.d.ts`) tell you what fields exist; source code (e.g., `Space.js`, `Members.js`) tells you how methods behave (side effects, prerequisites like `space.enter()`). When in doubt, read the implementation — not just the types. See `references/patterns.md` "Field display rules" in the `ably-new-command` skill for the full path table and import conventions.

## Development Standards

- Use TypeScript and follow standard naming conventions.
- This project uses `pnpm` (not npm or yarn).
- When installing libraries, use `pnpm add` (not manual package.json edits) to ensure latest versions.
- Avoid unnecessary dependencies — don't write code when libraries solve common problems, but don't install a library for every problem either.
- Code quality matters. The target audience is experienced developers who will read this code.

## Before Marking Complete

- [ ] `pnpm prepare` succeeds
- [ ] `pnpm exec eslint .` shows 0 errors
- [ ] `pnpm test:unit` passes
- [ ] No debug artifacts remain
- [ ] Docs updated if needed (especially `docs/Project-Structure.md` when adding/moving files, `docs/Testing.md` when changing test patterns)
- [ ] Skills updated if needed (see below)
- [ ] Followed oclif patterns

## Keeping Skills Up to Date

Skills in `.claude/skills/` encode the project's conventions and patterns. When you change the source of truth (base classes, helpers, flags, error handling, test helpers), **you must update the skills that reference those patterns**. Stale skills cause Claude to generate incorrect code.

**When to update skills:**
- Changed a base class method signature or behavior (`base-command.ts`, `control-base-command.ts`, `chat-base-command.ts`, `spaces-base-command.ts`, `stats-base-command.ts`)
- Added, renamed, or removed output helpers in `src/utils/output.ts`
- Changed flag definitions in `src/flags.ts`
- Changed error handling patterns (e.g., `fail()`, `CommandError`)
- Changed test helpers or mock patterns in `test/helpers/`
- Added a new base class or removed an existing one

**Which files to check:**
- `ably-new-command/SKILL.md` — the primary source of conventions for creating commands
- `ably-new-command/references/patterns.md` — implementation templates (must match actual code)
- `ably-new-command/references/testing.md` — test scaffolds (must match actual test helpers)
- `ably-review/SKILL.md` — branch review checks (must know current method names)
- `ably-codebase-review/SKILL.md` — codebase review checks (must know current method names)

**How to verify:** After updating skills, grep the skill files for the old method/pattern name to ensure no stale references remain.
