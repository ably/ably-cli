# Testing Strategy & Policy

<div align="center">
<h3>📘 ESSENTIALS FIRST 📘</h3>
</div>

> **💡 QUICK START:** Run `pnpm test` for all tests or `pnpm test:unit` for faster unit tests.
> **📋 MANDATORY:** All code changes require related tests. See [AGENTS.md](../AGENTS.md).
> **🐛 DEBUGGING:** See [Debugging Guide](Debugging.md) for troubleshooting tips and the [Debug Test Execution](#-debug-test-execution) section below.
> **🔍 TROUBLESHOOTING:** See [Troubleshooting Guide](Troubleshooting.md) for common errors.

---

## 🚀 Testing Goals & Guiding Principles

1.  **Confidence:** Ensure each command works as intended and avoid regressions.
2.  **Speed & Developer Experience:** Most tests should be quick to run, easy to debug, and not require a live environment.
3.  **Real Integration Coverage (where needed):** Some commands may need to be tested against real APIs (e.g., Ably's pub/sub product APIs and Control APIs) to verify end-to-end flows—especially for mission-critical commands.
4.  **Scalability:** The test setup should scale as commands grow in complexity.
5.  **Mandatory Coverage:** Adding or updating relevant tests is a **required** step for all feature additions or bug fixes.

---

## 🏃‍♂️ Running Tests

Refer to [AGENTS.md](../AGENTS.md) for the mandatory requirement to run tests.

| Test Type | Command | Description |
|-----------|---------|-------------|
| **All Tests** | `pnpm test` | Run all test types except Playwright |
| **Unit Tests** | `pnpm test:unit` | Fast tests with mocked dependencies |
| **Integration Tests** | `pnpm test:integration` | Tests with mocked Ably services |
| **E2E Tests** | `pnpm test:e2e` | Tests against real Ably services |
| **TTY Tests** | `pnpm run test:tty` | Interactive mode SIGINT tests (requires real TTY, local only) |
| **Playwright Tests** | `pnpm test:playwright` | Web CLI browser tests |

**Run Specific Files:**
```bash
# CLI Tests - Run a specific test file
pnpm test test/unit/commands/bench/bench.test.ts

# CLI Tests - Run all tests in a directory
pnpm test test/unit/commands/auth/**/*.test.ts
```

---

## 🐛 Debug Test Execution

The test runner includes built-in debugging support to help diagnose test failures, especially for E2E tests that interact with real services.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `E2E_DEBUG=true` | Enable detailed test debugging output |
| `ABLY_CLI_TEST_SHOW_OUTPUT=true` | Show detailed CLI output during tests |
| `TEST_DEBUG=true` | Alias for E2E_DEBUG |

### Examples

```bash
# Debug E2E tests with verbose output
E2E_DEBUG=true ABLY_CLI_TEST_SHOW_OUTPUT=true pnpm test:e2e

# Debug specific failing tests
E2E_DEBUG=true pnpm run test 'test/e2e/rooms/*.test.ts'

# Debug specific test file with grep filter
pnpm test test/e2e/spaces/*.test.ts --t "should have properly structured spaces member commands"
```

### Debug Output Features

When debugging is enabled (`E2E_DEBUG=true` and/or `ABLY_CLI_TEST_SHOW_OUTPUT=true`), you'll see:
- ✅ **Detailed console output** from the CLI commands being tested
- ✅ **Ably SDK logs** showing connection and API interactions
- ✅ **Process cleanup information** from the test setup
- ✅ **Enhanced error reporting** with full stack traces

---

### 🔧 Pre-Push Validation

The `scripts/pre-push-validation.sh` script runs a comprehensive test suite:

```bash
# Run the full pre-push validation
./scripts/pre-push-validation.sh
```

The script will:
- Build and prepare the project
- Run linter checks
- Run all unit, integration, and E2E tests
- Clean up automatically after completion

---

<details>
<summary><h2>📊 Testing Approach - Expand for Details</h2></summary>

### 🧪 Unit Tests (`test/unit`)

*   **Primary Purpose:** Quickly verify command logic, flag parsing, input validation, error handling, and basic output formatting **in isolation**. Focus on testing individual functions or methods within a command class.
*   **Dependencies:** **MUST** stub/mock all external dependencies (Ably SDK calls, Control API requests, filesystem access, `ConfigManager`, etc.). Use libraries like `vitest` and `nock`.
*   **Speed:** Very fast; no network or filesystem dependency.
*   **Value:** Useful for testing complex parsing, conditional logic, and edge cases within a command, but **less effective** at verifying core interactions with Ably services compared to Integration/E2E tests.

**CLI Core and Commands:**
*   **Tools:** Vitest, `@oclif/test`.
*   **Location:** Primarily within the `test/unit/` directory, mirroring the `src/` structure.
*   **Execution:** Run all unit tests with `pnpm test:unit` or target specific files, e.g., `pnpm vitest --project unit test/unit/commands/bench/bench.test.ts`.

**Example (Vitest):**
```typescript
// Example unit test with proper mocking
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {AblyCommand} from '../../src/base/ably-command'

describe('MyCommand', () => {
  let mockClient: any

  beforeEach(() => {
    // Set up mocks
    mockClient = {
      channels: {
        get: vi.fn().mockReturnedValue(...)
      },
      close: vi.fn(),
    }
    vi.spyOn(AblyCommand.prototype, 'getAblyClient').mockResolvedValue(mockClient)
  })

  it('publishes a message to the specified channel', async () => {
    // Test implementation
  })
})
```

**React Web CLI Components (`@ably/react-web-cli`):**
*   **Frameworks:** [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Vitest provides a Jest-compatible API for running tests, assertions, and mocking. React Testing Library is used to interact with components like a user would.
*   **Location:** Test files are co-located with the components they test (e.g., `packages/react-web-cli/src/AblyCliTerminal.test.tsx`).
*   **Execution:**
    *   Run all tests for `@ably/react-web-cli`: `pnpm --filter @ably/react-web-cli test`.
    *   Individual files via Vitest CLI: `pnpm exec vitest packages/react-web-cli/src/AblyCliTerminal.test.tsx`.
*   **Mocking:** Dependencies (e.g., `@xterm/xterm`, WebSockets) are mocked using Vitest's capabilities (`vi.mock`, `vi.fn`).

#### 🏗️ Testing Pyramid for React Web CLI Components

While developing the browser-based **Web CLI** we have found that an "inverted" test pyramid (many end-to-end Playwright tests, few unit tests) quickly becomes brittle and slows the feedback loop.  We therefore adopt a **pyramid approach** for this part of the codebase:

1.  **Unit tests (_broad base_) –** Exhaustive coverage of core logic that can execute **in isolation**:
    * `global-reconnect` timing & state machine.
    * React hooks and helpers inside `AblyCliTerminal` (without a real browser).
    * Mock **all** browser APIs (`WebSocket`, `xterm.js`, timers).

2.  **Focused E2E / Playwright tests (_narrow top_) –** Only verify **user-visible** flows:
    * Automatic reconnect succeeds when the server is restarted.
    * Users can cancel the reconnect countdown and later trigger a manual reconnect.

Everything else (exact countdown rendering, every internal state transition, console noise) is left to the unit layer.  This greatly reduces flake due to timing variance and Docker start-up times.

> **Tip for contributors:** If you find yourself mocking several browser APIs in a Playwright test, it probably belongs in a unit test instead.

### 🔄 Integration Tests (`test/integration`)

*   **Primary Purpose:** Verify the interaction between multiple commands or components, including interactions with *mocked* Ably SDKs or Control API services. Test the CLI execution flow.
*   **Dependencies:** Primarily stub/mock network calls (`nock` for Control API, `vi` stubs for SDK methods), but may interact with the local filesystem for config management (ensure isolation). Use `ConfigManager` mocks.
*   **Speed:** Relatively fast; generally avoids real network latency.
*   **Value:** Good for testing command sequences (e.g., `config set` then `config get`), authentication flow logic (with mocked credentials), and ensuring different parts of the CLI work together correctly without relying on live Ably infrastructure.
*   **Tools:** Vitest, `@oclif/test`, `nock`, `execa` (to run the CLI as a subprocess).

Refer to the [Debugging Guide](Debugging.md) for tips on debugging failed tests, including Playwright and Vitest tests.

### 🖥️ TTY Tests (`test/tty`)

*   **Primary Purpose:** Verify interactive mode behavior that depends on a real terminal (pseudo-TTY), such as SIGINT/Ctrl+C handling with readline.
*   **Dependencies:** Requires `node-pty` (already in devDependencies) to create real pseudo-terminals. Cannot run in CI (GitHub Actions runners have no TTY).
*   **Speed:** Fast (~2 seconds), but requires native module compilation.
*   **Value:** Tests SIGINT handling that is fundamentally untestable with piped stdio — readline's signal handling only works in real TTY environments.
*   **Tools:** Vitest, `node-pty`.
*   **Location:** `test/tty/` directory.
*   **Execution:** Run locally with `pnpm run test:tty`. Not included in `pnpm test:unit` or CI pipelines.
*   **Helpers:** `test/tty/tty-test-helper.ts` provides `spawnTty()`, `waitForOutput()`, `writeTty()`, `sendCtrlC()`, `killTty()` (async), and constants `PROMPT_PATTERN` (`"ably>"`) and `DEFAULT_WAIT_TIMEOUT` (8000ms). `ABLY_CLI_DEFAULT_DURATION` is intentionally omitted from the TTY vitest config — TTY tests manage their own timing via explicit `--duration` flags and real PTY I/O.

> **Note:** If `node-pty` fails to load, rebuild it with `pnpm rebuild node-pty`.

### 🌐 End-to-End (E2E) Tests (`test/e2e`)

*   **Primary Purpose:** Verify critical user flows work correctly against **real Ably services** using actual credentials (provided via environment variables).
*   **Dependencies:** Requires a live Ably account and network connectivity. Uses real Ably SDKs and Control API interactions.
*   **Scope:** Focus on essential commands and common workflows (login, app/key management basics, channel publish/subscribe/presence/history, logs subscribe).
*   **Speed:** Slowest test type due to network latency and real API interactions.
*   **Value:** Provides the highest confidence that the CLI works correctly for end-users in a real environment. **Preferred** over unit tests for verifying core Ably interactions.
*   **Tools:** Vitest, `@oclif/test`, `execa`, environment variables (`E2E_ABLY_API_KEY`, etc.).
*   **Frequency:** Run automatically in CI (GitHub Actions) on PRs and merges. Can be run locally but may incur costs.

**Example:**
```typescript
// Example E2E test with real services
import {describe, it, expect} from 'vitest'
import {execSync} from 'child_process'

describe('channels commands', () => {
  const testChannel = `test-${Date.now()}`
  const testMessage = 'Hello E2E test'

  it('can publish and then retrieve history from a channel', async () => {
    // Publish a message
    execSync(`ABLY_API_KEY=${process.env.E2E_ABLY_API_KEY} ably channels publish ${testChannel} "${testMessage}"`)

    // Wait a moment for message to be stored
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get message from history
    const result = execSync(
      `ABLY_API_KEY=${process.env.E2E_ABLY_API_KEY} ably channels history ${testChannel} --json`
    ).toString()

    const history = JSON.parse(result)
    expect(history).toBeInstanceOf(Array)
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0].data).toBe(testMessage)
  })
}, {timeout: 10000})
```

### 🎭 Playwright Tests (`test/e2e/web-cli`)

*   **Primary Purpose:** Verify the functionality of the Web CLI example application (`examples/web-cli`) running in a real browser.
*   **Dependencies:** Requires Node.js, a browser (installed via Playwright), and the Web CLI example app to be built.
*   **Speed:** Slow; involves browser automation and WebSocket connections.
*   **Value:** Ensures the embeddable React component works correctly with the hosted terminal server.
*   **Tools:** Playwright Test runner (`@playwright/test`).
*   **Frequency:** Run automatically in CI, separate from Vitest tests.

</details>

---

<details>
<summary><h2>🔧 Advanced Testing Guidance - Expand for Details</h2></summary>

## 📝 Test Coverage and Considerations

*   **Adding/Updating Tests:** When adding features or fixing bugs, add or update tests in the appropriate category (Unit, Integration, E2E, Playwright).
*   **Focus:** Prioritize **Integration and E2E tests** for verifying core functionality involving Ably APIs/SDKs, as unit tests with extensive mocking provide less confidence in these areas.
*   **Output Modes:** Tests should cover different output modes where relevant:
    *   Default (Human-readable)
    *   JSON (`--json`)
    *   Pretty JSON (`--pretty-json`)
*   **Web CLI Mode:** Integration/E2E tests for commands with different behavior in Web CLI mode should simulate this using `ABLY_WEB_CLI_MODE=true` environment variable. The Playwright tests cover the actual Web CLI environment.
*   **Test Output:** Test output (stdout/stderr) should be clean. Avoid polluting test logs with unnecessary debug output from the CLI itself. Failures should provide clear error messages.
*   **Asynchronous Operations:** Use `async/await` properly. Avoid brittle `setTimeout` calls where possible; use event listeners or promise-based waits.
*   **Resource Cleanup:** Ensure tests clean up resources (e.g., close Ably clients, kill subprocesses, delete temp files). Use the `afterEach` or `afterAll` hooks and helpers like `trackAblyClient`.
*   **Realtime SDK Stubbing:** For Unit/Integration tests involving the Realtime SDK, stub the SDK methods directly (`vi.spyOn(ably.channels.get('...'), 'subscribe')`) rather than trying to mock the underlying WebSocket, which is complex and brittle.
*   **Credentials:** E2E tests rely on `E2E_ABLY_API_KEY` (and potentially others) being set in the environment (locally via `.env` or in CI via secrets). **Never** hardcode credentials in tests.

## 🗂️ Codebase Integration & Structure

### Folder Structure

```
.
├── src/
│   └── commands/
├── packages/
│   └── react-web-cli/          # @ably/react-web-cli (tests co-located with components)
├── test/
│   ├── setup.ts                # Global test setup (runs in Vitest context)
│   ├── root-hooks.ts           # Root hooks for E2E test lifecycle
│   ├── helpers/                # Shared test utilities
│   │   ├── cli-runner.ts           # CliRunner class for E2E process management
│   │   ├── cli-runner-store.ts     # Per-test runner tracking
│   │   ├── command-helpers.ts      # High-level E2E helpers
│   │   ├── e2e-test-helper.ts      # E2E setup and teardown
│   │   ├── mock-ably-*.ts          # Mock SDKs (chat, realtime, rest, spaces)
│   │   └── mock-config-manager.ts  # MockConfigManager (provides test auth)
│   ├── unit/                   # Fast, mocked tests
│   │   ├── base/               # Base command class tests
│   │   ├── base-command/       # AblyBaseCommand tests
│   │   ├── commands/           # Command unit tests (mirrors src/commands/)
│   │   ├── core/               # Core CLI functionality tests
│   │   ├── help/               # Help system tests
│   │   ├── hooks/              # Hook tests
│   │   ├── services/           # Service tests
│   │   └── utils/              # Utility tests
│   ├── integration/            # Multi-component tests (mocked external services)
│   │   ├── commands/           # Command flow integration tests
│   │   └── interactive-mode.test.ts
│   ├── e2e/                    # End-to-End tests (runs against real Ably)
│   │   ├── auth/               # Auth E2E tests
│   │   ├── bench/              # Benchmark E2E tests
│   │   ├── channels/           # Channel E2E tests
│   │   ├── connections/        # Connection E2E tests
│   │   ├── control/            # Control API E2E tests
│   │   ├── core/               # Core CLI E2E tests
│   │   ├── interactive/        # Interactive mode E2E tests
│   │   ├── rooms/              # Chat rooms E2E tests
│   │   ├── spaces/             # Spaces E2E tests
│   │   ├── stats/              # Stats E2E tests
│   │   └── web-cli/            # Playwright browser tests for Web CLI
│   └── manual/                 # Manual test scripts
└── ...
```

### E2E Test Organization

E2E tests are organized by feature/topic (e.g., `channels-e2e.test.ts`, `presence-e2e.test.ts`) to improve maintainability and allow targeted runs. They use shared helpers from `test/helpers/e2e-test-helper.ts`.

</details>

---

## 🧩 Shared Test Helpers & Conventions

### Required Describe Block Order

Every unit test file for a command MUST include all 5 of these describe blocks in this canonical order (exact names):

1. **`"help"`** — verify `--help` shows USAGE
2. **`"argument validation"`** — test required args or unknown flag rejection
3. **`"functionality"`** — core happy-path behavior
4. **`"flags"`** — verify flags exist and work
5. **`"error handling"`** — API errors, network failures

Do NOT use variants like `"command arguments and flags"`, `"command flags"`, `"flag options"`, or `"parameter validation"`. Exempt: `interactive.test.ts`, `interactive-sigint.test.ts`, `bench/*.test.ts`.

### Standard Test Generators

The file `test/helpers/standard-tests.ts` provides generator functions that produce the boilerplate tests for the required describe blocks:

- **`standardHelpTests(command, importMetaUrl)`** — generates the `"help"` describe block, verifying `--help` output contains USAGE
- **`standardArgValidationTests(command, importMetaUrl, options?)`** — generates the `"argument validation"` block, testing unknown flag rejection. If `options.requiredArgs` is provided, also tests that missing args produce an error.
- **`standardFlagTests(command, importMetaUrl, flags)`** — generates the `"flags"` block, verifying each flag in the array appears in `--help` output
- **`standardControlApiErrorTests(opts)`** — generates 401/500/network error tests for Control API commands. Call **inside** a `describe("error handling", ...)` block (does NOT create the describe block itself). Takes `{ commandArgs, importMetaUrl, setupNock }` where `setupNock(scenario)` receives `"401"`, `"500"`, or `"network"`.

Call the generators at describe-block level (not inside nested describes). You still need to write `"functionality"` and `"error handling"` blocks manually since those are command-specific. For Control API commands, combine `standardControlApiErrorTests()` with command-specific error tests inside the same `describe("error handling", ...)` block.

### Control API Test Helpers

The file `test/helpers/control-api-test-helpers.ts` provides shared helpers for testing commands that use the Control API with nock:

- **`nockControl()`** — returns a `nock` scope pre-configured for `https://control.ably.net`
- **`getControlApiContext()`** — returns `{ appId, accountId, mock }` from `MockConfigManager`
- **`controlApiCleanup()`** — calls `nock.cleanAll()` for use in `afterEach` hooks
- **`CONTROL_HOST`** — the default Control API host constant (`"https://control.ably.net"`)

### Mock Factory Functions

The file `test/fixtures/control-api.ts` provides factory functions for building realistic Control API response bodies. Each accepts an optional `Partial<T>` to override any field:

- **`mockApp(overrides?)`** — mock app object (id, name, status, tlsOnly, etc.)
- **`mockKey(overrides?)`** — mock API key object (id, key, capability, etc.)
- **`mockRule(overrides?)`** — mock integration rule object (ruleType, source, target, etc.)
- **`mockQueue(overrides?)`** — mock queue object (name, region, state, messages, stats, amqp, stomp, etc.)
- **`mockNamespace(overrides?)`** — mock namespace object (id, persisted, pushEnabled, etc.)
- **`mockStats(overrides?)`** — mock stats object (intervalId, unit, all.messages, etc.)

```typescript
import { mockApp, mockQueue } from "../../../fixtures/control-api.js";

// Use defaults
nockControl().get(`/v1/apps/${appId}`).reply(200, mockApp());

// Override specific fields
nockControl().get(`/v1/apps/${appId}/queues`).reply(200, [
  mockQueue({ id: "q-1", appId, name: "my-queue" }),
]);
```

### NDJSON Test Helpers

The file `test/helpers/ndjson.ts` provides helpers for testing JSON output:

- **`parseNdjsonLines(stdout)`** — parse stdout containing one JSON object per line into an array of records
- **`parseLogLines(lines)`** — parse an array of log lines into JSON records (skips non-JSON)
- **`captureJsonLogs(fn)`** — capture all `console.log` output from an async function and parse as JSON records. Use to verify JSON envelope structure in `--json` mode.

---

## 🎯 Best Practices Quick Reference

1. **✅ DO** prioritize Integration and E2E tests for core Ably functionality
2. **✅ DO** clean up all resources in tests (clients, connections, mocks)
3. **✅ DO** use proper mocking (`vitest`, `nock`) for Unit/Integration tests
4. **✅ DO** avoid testing implementation details when possible (test behavior)
5. **✅ DO** use path-based test execution for faster development workflow

6. **❌ DON'T** rely solely on unit tests for Ably API interactions
7. **❌ DON'T** leave resources unclosed (memory leaks)
8. **❌ DON'T** use brittle `setTimeout` when avoidable
9. **❌ DON'T** hardcode credentials or API keys in tests

---

<div align="center">
🔍 For detailed troubleshooting help, see the <a href="Troubleshooting.md">Troubleshooting Guide</a>.
</div>
