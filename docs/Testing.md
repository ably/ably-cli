# Testing Guide

## Test layers

| Layer | Directory | Purpose | Speed | Mocking | When to use |
|-------|-----------|---------|-------|---------|-------------|
| **Unit** | `test/unit/` | Command logic, flag parsing, output format, error handling | Fast (~ms) | Everything mocked (SDK, REST, config) | Every command, every PR |
| **E2E** | `test/e2e/` | Real workflows against live Ably | Slow (~seconds) | Nothing mocked | Core workflows, new integrations |
| **TTY** | `test/tty/` | Interactive mode with real pseudo-terminal | Fast (~2s) | No Ably, real PTY | SIGINT/readline behavior |
| **Subprocess** | `test/integration/` | Interactive mode via spawned process | Fast | No Ably, real process | Interactive command flows |

> **Note on "integration" tests:** The `test/integration/` directory contains 4 files, all testing interactive mode subprocess behavior. It is not a general-purpose integration layer. A future PR may rename it to `test/subprocess/` or fold it into `test/tty/`.

### Unit tests

The workhorse. Every command gets unit tests. They should cover every code branch and every conditional — if there's an `if`, both paths get tested. We mock at the Ably library level (SDK, Control API, config), so tests run in milliseconds with no network. Auth is provided automatically by `MockConfigManager` — no env vars needed.

### E2E tests

Run against real Ably services with real credentials (via env vars). These cover the entire journey — the CLI's interaction with the actual Ably service, end to end. Every command must have an E2E test. E2E tests should cover the happy path and major sad paths (e.g., invalid capabilities, nonexistent resources). They are slow and can incur costs, so use them deliberately.

### TTY tests

Use `node-pty` to create a real pseudo-terminal. This is the only way to test readline SIGINT handling, which doesn't work with piped stdio. Local only — cannot run in CI (no TTY in GitHub Actions runners). Rebuild `node-pty` with `pnpm rebuild node-pty` if it fails to load.

### Subprocess (integration) tests

Spawn the CLI as a child process to test interactive mode flows. These verify multi-step interactive prompts, terminal feedback, and process lifecycle without needing a real TTY.

### Test directory layout

| Directory | Contents |
|-----------|----------|
| `test/helpers/` | Shared utilities — `runCommand()`, mock SDKs, mock config, standard test generators, nock helpers |
| `test/fixtures/` | Factory functions for mock API responses (`mockApp()`, `mockKey()`, etc.) |
| `test/unit/` | Mirrors `src/` structure — e.g., `src/commands/channels/publish.ts` → `test/unit/commands/channels/publish.test.ts` |
| `test/integration/` | Interactive mode subprocess tests (4 files) |
| `test/tty/` | TTY tests with `node-pty` helpers |
| `test/e2e/` | E2E tests organized by feature (`channels/`, `rooms/`, `spaces/`, etc.) |

---

## What tests does my PR need?

### Always required

- **Unit tests** for any new or changed command, with all 5 required describe blocks (see [Test structure](#test-structure) below).
- **E2E tests** for any new or changed command — happy path and major sad paths.

### Sometimes required

- **TTY tests** when: changing SIGINT/Ctrl+C handling or readline behavior in interactive mode.
- **Subprocess tests** when: changing interactive mode prompt flows or subprocess lifecycle.

### Output mode coverage

Unit tests for commands with `--json` support should test all three output modes:
- Default (human-readable)
- `--json` (compact NDJSON)
- `--pretty-json` (indented JSON)

### Not needed

- E2E tests that only cover things unit tests already cover: flag parsing, help text, error messages, output formatting.
- Duplicate coverage across layers — one layer per behavior is enough.

---

## Choosing the right layer

```text
What are you testing?
│
├─ Flag parsing, help output, error messages, output format?
│  → Unit test
│
├─ Real pub/sub, CRUD against Ably, multi-step workflow with real services?
│  → E2E test
│
├─ SIGINT / Ctrl+C with readline in a real terminal?
│  → TTY test
│
└─ Interactive mode subprocess behavior (prompts, process lifecycle)?
   → Subprocess (integration) test
```

Explicit rules:
- Flag parsing, help text, error messages, output formatting → **Unit**. Always.
- SDK method calls with mocked responses → **Unit**. Mock the SDK, assert the command calls it correctly.
- Real network round-trip to Ably (pub/sub, presence, history, Control API CRUD) → **E2E**.
- SIGINT/Ctrl+C with readline → **TTY**. Piped stdio cannot test this.
- Interactive mode prompts and subprocess lifecycle → **Subprocess (integration)**.

---

## Running tests

| Command | What it runs |
|---------|-------------|
| `pnpm test:unit` | All unit tests |
| `pnpm test:integration` | Subprocess/interactive tests |
| `pnpm test:e2e` | E2E tests (needs `E2E_ABLY_API_KEY` etc.) |
| `pnpm test:tty` | TTY tests (local only, needs real terminal) |
| `pnpm test` | Unit + integration + E2E |
| `pnpm test test/unit/commands/foo.test.ts` | Specific test file |
| `pnpm test test/unit/commands/auth/**/*.test.ts` | All tests in a directory |
| `pnpm test:playwright` | Web CLI browser tests (Playwright, separate from Vitest) |

### Debugging E2E failures

Set `E2E_DEBUG=true` and/or `ABLY_CLI_TEST_SHOW_OUTPUT=true` for verbose output:

```bash
E2E_DEBUG=true ABLY_CLI_TEST_SHOW_OUTPUT=true pnpm test:e2e
```

See [E2E-Testing-CLI-Runner.md](E2E-Testing-CLI-Runner.md) for the full E2E debugging guide.

---

## Test structure

### Required describe blocks

Every unit test file for a command must include all 5 of these describe blocks (exact names, in this order):

1. **`"help"`** — verify `--help` shows USAGE
2. **`"argument validation"`** — test required args or unknown flag rejection
3. **`"functionality"`** — core happy-path behavior
4. **`"flags"`** — verify flags exist and work
5. **`"error handling"`** — API errors, network failures

Do NOT use variants like `"command arguments and flags"`, `"command flags"`, `"flag options"`, or `"parameter validation"`.

Exempt: `interactive.test.ts`, `interactive-sigint.test.ts`, `bench/*.test.ts`.

### Auth in tests

Authentication in tests uses different mechanisms depending on the layer. See [General Usage Env Variables](Environment-Variables/General-Usage.md) for full details on `ABLY_API_KEY`, `ABLY_TOKEN`, `ABLY_ACCESS_TOKEN`, and other auth env vars.

**Unit tests** — `MockConfigManager` provides auth automatically. No env vars or flags needed:

```typescript
// WRONG — don't pass auth flags
runCommand(["channels", "publish", "my-channel", "hello", "--api-key", key]);

// CORRECT — MockConfigManager handles it
runCommand(["channels", "publish", "my-channel", "hello"]);

// CORRECT — access mock auth values when needed
import { getMockConfigManager } from "../../helpers/mock-config-manager.js";
const mockConfig = getMockConfigManager();
const apiKey = mockConfig.getApiKey()!;
```

**E2E tests** — commands run as real subprocesses, so auth must go via env vars:

```typescript
runCommand(["channels", "publish", "my-channel", "hello"], {
  env: { ABLY_API_KEY: key },
});
```

### Duration in tests

Unit and integration tests set `ABLY_CLI_DEFAULT_DURATION: "0.25"` in `vitest.config.ts`, so subscribe/long-running commands auto-exit after 250ms. Do NOT pass `--duration` to `runCommand()` — it overrides the fast default. See [General Usage Env Variables](Environment-Variables/General-Usage.md#ably_cli_default_duration) for full details on this variable and the 28 commands it affects.

Exceptions: `test:wait` command tests (required flag), `interactive-sigint.test.ts` (needs longer for SIGINT), and help output checks.

### Resource cleanup

**Unit tests:** Mock SDK init and cleanup is handled globally by `test/unit/setup.ts` — no per-test setup needed. If your test uses nock, call `nock.cleanAll()` in `afterEach` (or use `controlApiCleanup()`).

**E2E tests:** Use `trackAblyClient(client)` to register clients for automatic cleanup, and call helpers from `e2e-test-helper.ts` in `afterAll` to tear down test apps and connections.

---

## Standard test generators

`test/helpers/standard-tests.ts` provides generators for boilerplate describe blocks:

| Generator | Creates |
|-----------|---------|
| `standardHelpTests(command, importMetaUrl)` | `"help"` block — verifies `--help` contains USAGE |
| `standardArgValidationTests(command, importMetaUrl, options?)` | `"argument validation"` block — tests unknown flag rejection and optionally missing required args |
| `standardFlagTests(command, importMetaUrl, flags)` | `"flags"` block — verifies each flag appears in `--help` output |
| `standardControlApiErrorTests(opts)` | 401/500/network error tests — call **inside** `describe("error handling", ...)` |

Call generators at describe-block level. Write `"functionality"` and `"error handling"` blocks manually (they're command-specific).

---

## Helpers reference

### Core test helpers (`test/helpers/command-helpers.ts`)

| Helper | Purpose |
|--------|---------|
| `runCommand(args, opts?)` | Run a CLI command in-process. Returns `{ stdout, stderr, error? }`. Used in unit and integration tests. |
| `runLongRunningBackgroundProcess(args, opts?)` | Spawn a long-running command (subscribe, etc.) as a background process. Returns a handle with `stdout`, `stderr`, and `kill()`. |

### Mock SDKs (`test/helpers/mock-ably-*.ts`)

| File | Provides |
|------|----------|
| `mock-ably-realtime.ts` | Mock `Ably.Realtime` — channels, presence, connection events |
| `mock-ably-rest.ts` | Mock `Ably.Rest` — REST channel operations, request() |
| `mock-ably-chat.ts` | Mock Chat SDK — rooms, messages, typing, reactions |
| `mock-ably-spaces.ts` | Mock Spaces SDK — members, cursors, locations, locks |

These are initialized and cleaned up automatically in `test/unit/setup.ts` — no per-test setup needed.

### Control API test helpers (`test/helpers/control-api-test-helpers.ts`)

| Helper | Purpose |
|--------|---------|
| `nockControl()` | Returns a `nock` scope for `https://control.ably.net` |
| `getControlApiContext()` | Returns `{ appId, accountId, mock }` from MockConfigManager |
| `controlApiCleanup()` | Calls `nock.cleanAll()` — use in `afterEach` |
| `CONTROL_HOST` | `"https://control.ably.net"` constant |

### Mock factories (`test/fixtures/control-api.ts`)

Each accepts an optional `Partial<T>` to override fields:

| Factory | Creates |
|---------|---------|
| `mockApp()` | Mock app object |
| `mockKey()` | Mock API key object |
| `mockRule()` | Mock integration rule object |
| `mockQueue()` | Mock queue object |
| `mockNamespace()` | Mock namespace object |
| `mockStats()` | Mock stats object |

### NDJSON helpers (`test/helpers/ndjson.ts`)

| Helper | Purpose |
|--------|---------|
| `parseNdjsonLines(stdout)` | Parse stdout with one JSON object per line into an array |
| `parseLogLines(lines)` | Parse log line array into JSON records (skips non-JSON) |
| `captureJsonLogs(fn)` | Capture `console.log` output from async function, parse as JSON |

### TTY helpers (`test/tty/tty-test-helper.ts`)

| Helper | Purpose |
|--------|---------|
| `spawnTty()` | Spawn CLI in a real pseudo-terminal |
| `waitForOutput()` | Wait for specific output text |
| `writeTty()` | Send input to the terminal |
| `sendCtrlC()` | Send SIGINT |
| `killTty()` | Kill the PTY process (async) |
| `PROMPT_PATTERN` | `"ably>"` |
| `DEFAULT_WAIT_TIMEOUT` | 8000ms |

---

## Related

- [Debugging Guide](Debugging.md) — Debugging tips for CLI development, including `DEBUG` and Node inspector
- [E2E Testing CLI Runner](E2E-Testing-CLI-Runner.md) — E2E test runner system, debugging flags, and process management
- [Troubleshooting](Troubleshooting.md) — Solutions for common build and test errors
