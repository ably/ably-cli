# Environment Variables — Development Stage Usage

These variables are for CLI contributors, development, testing, and internal modes. They are **not intended for end-user configuration** unless explicitly noted.

> For user-facing environment variables (authentication, configuration, behavioral control, host overrides), see [General Usage](General-Usage.md).

---

## Quick Reference

| Variable | Category | Purpose | Default |
| --- | --- | --- | --- |
| [`ABLY_SHOW_DEV_FLAGS`](#ably_show_dev_flags) | Development | Reveal hidden dev flags | Not set |
| [`ABLY_CONTROL_HOST`](#ably_control_host) | Host Override | Override Control API host | `control.ably.net` |
| [`ABLY_DASHBOARD_HOST`](#ably_dashboard_host) | Host Override | Override Ably dashboard URL | `https://ably.com` |
| [`DEBUG`](#debug) | Debugging | oclif framework debug output | Not set |
| [`TERMINAL_DIAGNOSTICS`](#terminal_diagnostics) | Debugging | Terminal state diagnostics | Not set |
| [`ABLY_CLI_TEST_MODE`](#ably_cli_test_mode) | Testing | Enable test mode | Not set |
| [`SKIP_CONFIRMATION`](#skip_confirmation) | Testing | Auto-confirm prompts (test alias for `ABLY_CLI_NON_INTERACTIVE`) | Not set |
| [`GENERATING_DOC`](#generating_doc) | Tooling | Doc generation mode | Not set |
| [`CI`](#ci) | Environment | CI detection | Not set |
| [`ABLY_INTERACTIVE_MODE`](#ably_interactive_mode) | Internal | Interactive shell mode flag | Not set |
| [`ABLY_WRAPPER_MODE`](#ably_wrapper_mode) | Internal | Wrapper script detection | Not set |
| [`ABLY_SUPPRESS_WELCOME`](#ably_suppress_welcome) | Internal | Suppress welcome logo | Not set |
| [`ABLY_WEB_CLI_MODE`](#ably_web_cli_mode) | Internal | Web browser CLI mode | Not set |
| [`ABLY_ANONYMOUS_USER_MODE`](#ably_anonymous_user_mode) | Internal | Anonymous web CLI mode | Not set |
| [`ABLY_CURRENT_COMMAND`](#ably_current_command) | Internal | Current command tracking | Set automatically |
| [`NODE_ENV`](#node_env) | Internal | Node environment override | Not set |

---

## Development & Debugging

### `ABLY_SHOW_DEV_FLAGS`

Reveal hidden development flags in `--help` output.

| Property | Value |
| --- | --- |
| **Format** | `"true"` (exact string match) |

When set, the following normally-hidden flags become visible:

| Flag | Purpose |
| --- | --- |
| `--port` | Override port for product API calls |
| `--tls-port` | Override TLS port for product API calls |
| `--tls` | Enable/disable TLS for product API calls |
| `--control-host` | Override Control API host |
| `--dashboard-host` | Override Ably dashboard host |
| `--endpoint` | Set custom endpoint for login/account commands |

In interactive mode, hidden flags are also filtered from tab completion unless this is set.

**Example:**

```shell
ABLY_SHOW_DEV_FLAGS=true ably channels publish --help
```

---

### `ABLY_CONTROL_HOST`

Override the Control API host for all account/app management commands. Only needed when developing or testing the CLI against non-production Ably environments (staging, local).

| Property | Value |
| --- | --- |
| **Format** | Hostname |
| **Default** | `control.ably.net` |
| **Precedence** | `--control-host` flag > **`ABLY_CONTROL_HOST`** > default |
| **Flag mapping** | Maps to `--control-host` (hidden flag) |

If the host value contains `"local"`, the CLI uses `http://` instead of `https://` for API calls.

**Example:**

```shell
export ABLY_CONTROL_HOST="custom-control.example.com"
ably apps list
```

---

### `ABLY_DASHBOARD_HOST`

Override the Ably dashboard URL for commands that generate dashboard links. Only needed when developing or testing the CLI against non-production Ably environments (staging, local).

| Property | Value |
| --- | --- |
| **Format** | URL (auto-prepends `https://` if no protocol) |
| **Default** | `https://ably.com` |
| **Flag mapping** | Maps to `--dashboard-host` (hidden flag) |

Currently only `ably channels inspect` generates dashboard links, constructing:
`{dashboardHost}/accounts/{accountId}/apps/{appId}/channels/{channelName}`

**Example:**

```shell
export ABLY_DASHBOARD_HOST="https://custom-dashboard.example.com"
ably channels inspect my-channel
```

---

### `DEBUG`

Enable oclif framework debug output for diagnosing CLI internals.

| Property | Value |
| --- | --- |
| **Format** | Debug pattern (e.g., `"oclif*"`) |

When set:
- Stack traces are shown on errors in interactive mode
- `NODE_ENV` is **not** overridden to `"production"` in interactive mode
- oclif emits detailed framework-level debug output

See [Debugging Guide](../Debugging.md#debugging-the-cli-locally) for more debugging techniques including Node inspector and verbose flags.

**Example:**

```shell
DEBUG=oclif* ably channels publish my-channel "test"
```

---

### `TERMINAL_DIAGNOSTICS`

Enable terminal state diagnostics logging for debugging TTY/stdin/stdout issues.

| Property | Value |
| --- | --- |
| **Format** | Any value (truthy check) |

Logs detailed terminal state information including:
- stdin: TTY status, fd, readable, destroyed, rawMode
- stdout: TTY status, fd, writable, destroyed
- Process: PID, PPID, exit code

**Example:**

```shell
TERMINAL_DIAGNOSTICS=1 ably-interactive
```

---

### `CI`

Standard CI environment detection. Not Ably-specific.

| Property | Value |
| --- | --- |
| **Format** | Any value |

When set:
- TTY-dependent features are disabled (interactive terminal detection returns false)
- Stats display formatting may differ

---

## Testing

### `ABLY_CLI_TEST_MODE`

Enable test mode with a mock config manager.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Used by the test harness (set automatically during test runs). Enables mock config manager and adjusts various behaviors for test isolation. See [Testing Guide](../Testing.md) for test layers and auth patterns, and [E2E Testing CLI Runner](../E2E-Testing-CLI-Runner.md) for E2E-specific debugging with `E2E_DEBUG` and `ABLY_CLI_TEST_SHOW_OUTPUT`.

---

### `SKIP_CONFIRMATION`

Auto-confirm "Did you mean...?" and topic command prompts. Functionally identical to `ABLY_CLI_NON_INTERACTIVE`.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Primarily used in test code. For production/CI use, prefer `ABLY_CLI_NON_INTERACTIVE`. Does **not** skip destructive operation prompts (use `--force` for those).

---

### Test-Runner Environment Variables (Not CLI Variables)

The following env vars are used by the test runner and scripts, **not** by the CLI itself. They are documented in the [Testing Guide](../Testing.md) and [E2E Testing CLI Runner](../E2E-Testing-CLI-Runner.md):

| Variable | Purpose | Used by |
| --- | --- | --- |
| `E2E_ABLY_API_KEY` | API key for E2E tests against live Ably | `.env` / CI secrets |
| `E2E_ABLY_ACCESS_TOKEN` | Access token for E2E tests | `.env` / CI secrets |
| `E2E_DEBUG` | Enable detailed E2E test debugging output | Test runner |
| `ABLY_CLI_TEST_SHOW_OUTPUT` | Show CLI command output during E2E tests | Test runner |

---

## Tooling

### `GENERATING_DOC`

Enable documentation generation mode.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

When set:
- ANSI color codes are stripped from help output
- camelCase argument names are patched to snake_case for doc headings

Set automatically by the `pnpm generate-doc` script.

---

## Internal Variables (Set Programmatically)

These env vars are set by the CLI itself during execution. They should not be set manually.

### `ABLY_INTERACTIVE_MODE`

Signals that the CLI is running in interactive shell mode.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Behavioral changes when set:
- Help system throws errors instead of exiting the process
- Command examples show `ably> ` prefix instead of `$ ably `
- SIGINT: special double Ctrl+C detection for force quit (see [Exit Codes](../Exit-Codes.md) for exit code details)
- Cleanup timeout capped at 4.5 seconds
- `did-you-mean` suggestion format changes
- Version flag throws `EEXIT` error instead of exiting
- `status` and `support ask` commands adjust spinner behavior

See [Interactive REPL](../Interactive-REPL.md) for the full architecture and [Troubleshooting](../Troubleshooting.md#interactive-mode-issues) for common issues.

---

### `ABLY_WRAPPER_MODE`

Signals the interactive shell is running under the `ably-interactive` wrapper script.

| Property | Value |
| --- | --- |
| **Format** | `"1"` |

The wrapper script restarts the CLI after Ctrl+C interruptions and uses exit code 42 to detect user-initiated exits. See [Interactive REPL](../Interactive-REPL.md) for wrapper script details and [Exit Codes](../Exit-Codes.md#wrapper-script-behavior) for exit code behavior.

---

### `ABLY_SUPPRESS_WELCOME`

Suppress the welcome logo on subsequent interactive mode restarts.

| Property | Value |
| --- | --- |
| **Format** | `"1"` |

The wrapper script sets this after the first run so the logo only appears once per session.

---

### `ABLY_WEB_CLI_MODE`

Signals the CLI is running in a web browser terminal. See [Interactive REPL](../Interactive-REPL.md) for the web CLI architecture and motivation.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

**Restricted commands (14 patterns):**

`accounts:current`, `accounts:list`, `accounts:login`, `login`, `accounts:logout`, `accounts:switch`, `apps:create`, `apps:switch`, `apps:delete`, `auth:keys:switch`, `autocomplete*`, `config*`, `push:config:set-apns`, `push:config:set-fcm`

These commands are blocked because auth and app context are managed by the web UI, not the CLI.

---

### `ABLY_ANONYMOUS_USER_MODE`

Signals anonymous web CLI mode with a heavily restricted command set.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

**Restricted commands (15 patterns, 25+ commands):**

`accounts*`, `apps*`, `auth:keys*`, `auth:revoke-token`, `bench*`, `channels:list`, `channels:logs`, `connections:logs`, `rooms:list`, `spaces:list`, `logs*`, `integrations*`, `queues*`, `push*`, `stats*`

Pattern matching: Exact match OR prefix match (patterns ending with `*` match command ID prefix).

---

### `ABLY_CURRENT_COMMAND`

Tracks the currently executing command ID for interrupt feedback and signal handling.

| Property | Value |
| --- | --- |
| **Format** | Command ID string (e.g., `channels:subscribe`) |

---

### `NODE_ENV`

Set to `"production"` in interactive mode to suppress oclif error stack traces.

| Property | Value |
| --- | --- |
| **Format** | `"production"` |

Only set when `DEBUG` is not active.

---

## Related

- [General Usage](General-Usage.md) — User-facing environment variables for authentication, configuration, and behavioral control
- [Debugging Guide](../Debugging.md) — Debugging tips including `DEBUG` and terminal diagnostics
- [Testing Guide](../Testing.md) — Test layers, auth in tests, duration defaults, and test-specific env vars
- [Troubleshooting](../Troubleshooting.md) — Common issues with env vars, history, and configuration
