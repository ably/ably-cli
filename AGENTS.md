# AGENTS.md - Ably CLI

## Mandatory Workflow

**Run these IN ORDER for EVERY change:**

```bash
pnpm prepare        # 1. Build + update manifest/README
pnpm exec eslint .  # 2. Lint (MUST be 0 errors)
pnpm test:unit      # 3. Test (at minimum)
                    # 4. Update docs if needed
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
8. **`console.log` / `console.error`** - In commands, always use `this.log()` (stdout) and `this.logToStderr()` (stderr). `console.*` bypasses oclif and can't be captured by tests.

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
- **`clientIdFlag`** — `--client-id`. Add to any command that creates a realtime connection (publish, subscribe, presence enter/subscribe, spaces enter/get/subscribe, locks acquire/get/subscribe, cursors set/get/subscribe, locations set/get/subscribe, etc.). The rule: if the command calls `space.enter()`, creates a realtime client, or joins a channel, include `clientIdFlag`. Do NOT add globally.
- **`durationFlag`** — `--duration` / `-D`. Use for long-running subscribe/stream commands that auto-exit after N seconds.
- **`rewindFlag`** — `--rewind`. Use for subscribe commands that support message replay (default: 0).
- **`timeRangeFlags`** — `--start`, `--end`. Use for history and stats commands. Parse with `parseTimestamp()` from `src/utils/time.ts`. Accepts ISO 8601, Unix ms, or relative (e.g., `"1h"`, `"30m"`, `"2d"`).
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

**Test structure:**
- `test/unit/` — Fast, mocked tests. Auth via `MockConfigManager` (automatic). Only set `ABLY_API_KEY` env var when testing env var override behavior.
- `test/integration/` — Integration tests (e.g., interactive mode). Mocked external services but tests multi-component interaction.
- `test/e2e/` — Full scenarios against real Ably. Auth via env vars (`ABLY_API_KEY`, `ABLY_ACCESS_TOKEN`).
- Helpers in `test/helpers/` — `runCommand()`, `runLongRunningBackgroundProcess()`, `e2e-test-helper.ts`, `mock-config-manager.ts`.

**Running tests:**
```bash
pnpm test:unit                    # All unit tests
pnpm test:integration             # Integration tests
pnpm test:e2e                     # All E2E tests
pnpm test test/unit/commands/foo.test.ts  # Specific test
```

## CLI Output & Flag Conventions

### Output patterns (use helpers from src/utils/output.ts)
- **Progress**: `progress("Attaching to channel: " + resource(name))` — no color on action text, `progress()` appends `...` automatically. Never manually write `"Doing something..."` — always use `progress("Doing something")`.
- **Success**: `success("Message published to channel " + resource(name) + ".")` — green checkmark, **must** end with `.` (not `!`). Never use `chalk.green(...)` directly — always use the `success()` helper.
- **Listening**: `listening("Listening for messages.")` — dim, includes "Press Ctrl+C to exit." Don't combine listening text inside a `success()` call — use a separate `listening()` call.
- **Resource names**: Always `resource(name)` (cyan), never quoted — including in `logCliEvent` messages.
- **Timestamps**: `formatTimestamp(ts)` — dim `[timestamp]` for event streams. `formatMessageTimestamp(message.timestamp)` — converts Ably message timestamp (number|undefined) to ISO string. Both exported from `src/utils/output.ts`.
- **JSON guard**: All human-readable output (progress, success, listening messages) must be wrapped in `if (!this.shouldOutputJson(flags))` so it doesn't pollute `--json` output. Only JSON payloads should be emitted when `--json` is active.
- **JSON errors**: In catch blocks, use `this.handleCommandError(error, flags, component, context?)` for consistent error handling. It logs the event, emits JSON error when `--json` is active, and calls `this.error()` for human-readable output. For non-standard error flows, use `this.jsonError()` directly.
- **History output**: Use `[index] timestamp` ordering: `` `${chalk.dim(`[${index + 1}]`)} ${formatTimestamp(timestamp)}` ``. Consistent across all history commands (channels, logs, connection-lifecycle, push).

### Additional output patterns (direct chalk, not helpers)
- **Secondary labels**: `chalk.dim("Label:")` — for field names in structured output (e.g., `${chalk.dim("Profile:")} ${value}`)
- **Client IDs**: `chalk.blue(clientId)` — for user/client identifiers in events
- **Event types**: `chalk.yellow(eventType)` — for action/event type labels
- **Warnings**: `chalk.yellow("Warning: ...")` — for non-fatal warnings
- **Errors**: Use `this.error()` (oclif standard) for fatal errors, not `this.log(chalk.red(...))`
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
- `--app`: `"The app ID or name (defaults to current app)"` (for commands with `resolveAppId`), `"The app ID (defaults to current app)"` (for commands without)
- `--limit`: `"Maximum number of results to return (default: N)"`
- `--duration`: Use `durationFlag` from `src/flags.ts`. `"Automatically exit after N seconds"`, alias `-D`.
- `--rewind`: Use `rewindFlag` from `src/flags.ts`. `"Number of messages to rewind when subscribing (default: 0)"`. Apply with `this.configureRewind(channelOptions, flags.rewind, flags, component, channelName)`.
- `--start`/`--end`: Use `timeRangeFlags` from `src/flags.ts` and parse with `parseTimestamp()` from `src/utils/time.ts`. Accepts ISO 8601, Unix ms, or relative (e.g., `"1h"`, `"30m"`, `"2d"`).
- `--direction`: `"Direction of message retrieval (default: backwards)"` or `"Direction of log retrieval"`, options `["backwards", "forwards"]`.
- Channels use "publish", Rooms use "send" (matches SDK terminology)
- Command descriptions: imperative mood, sentence case, no trailing period (e.g., `"Subscribe to presence events on a channel"`)

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
- [ ] Followed oclif patterns
