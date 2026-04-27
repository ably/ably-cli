# Environment Variables

The Ably CLI supports 25 environment variables for authentication, configuration, behavioral control, and development. This document provides a comprehensive reference for each variable, organized into two main sections:

- **[General Usage](#general-usage)** — Variables intended for end users, CI/CD pipelines, and scripts
- **[Development Stage Usage](#development-stage-usage)** — Variables for CLI contributors, testing, debugging, and internal modes

> **Note:** The CLI does not automatically load `.env` files. Set environment variables in your shell, CI/CD configuration, or inline with your commands.

---

## Quick Reference

| Variable | Category | Purpose | Default |
| --- | --- | --- | --- |
| [`ABLY_API_KEY`](#ably_api_key) | Authentication | API key for data plane commands | None |
| [`ABLY_TOKEN`](#ably_token) | Authentication | Token/JWT for data plane commands | None |
| [`ABLY_ACCESS_TOKEN`](#ably_access_token) | Authentication | Access token for Control API commands | None |
| [`ABLY_APP_ID`](#ably_app_id) | App Selection | Default app for `--app` flag | None |
| [`ABLY_CLI_CONFIG_DIR`](#ably_cli_config_dir) | Configuration | Custom config directory | `~/.ably` |
| [`ABLY_HISTORY_FILE`](#ably_history_file) | Configuration | Custom history file location | `~/.ably/history` |
| [`ABLY_CLI_DEFAULT_DURATION`](#ably_cli_default_duration) | Behavior | Auto-exit long-running commands (seconds) | None (forever) |
| [`ABLY_CLI_NON_INTERACTIVE`](#ably_cli_non_interactive) | Behavior | Skip confirmation prompts | Not set |
| [`ABLY_ENDPOINT`](#ably_endpoint) | Host Override | Override Realtime/REST API endpoint | SDK default |
| [`ABLY_CONTROL_HOST`](#ably_control_host) | Host Override | Override Control API host | `control.ably.net` |
| [`ABLY_DASHBOARD_HOST`](#ably_dashboard_host) | Host Override | Override Ably dashboard URL | `https://ably.com` |
| [`ABLY_SHOW_DEV_FLAGS`](#ably_show_dev_flags) | Development | Reveal hidden dev flags | Not set |
| [`DEBUG`](#debug) | Debugging | oclif framework debug output | Not set |
| [`TERMINAL_DIAGNOSTICS`](#terminal_diagnostics) | Debugging | Terminal state diagnostics | Not set |
| [`ABLY_CLI_TEST_MODE`](#ably_cli_test_mode) | Testing | Enable test mode | Not set |
| [`SKIP_CONFIRMATION`](#skip_confirmation) | Testing | Skip prompts (test alias) | Not set |
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

## General Usage

These are the variables intended for end users, CI/CD pipelines, scripts, and production use.

### Authentication

#### `ABLY_API_KEY`

Authenticate data plane commands with an Ably API key. Bypasses the login workflow entirely.

| Property | Value |
| --- | --- |
| **Format** | `APP_ID.KEY_ID:KEY_SECRET` |
| **Applicable commands** | `channels`, `rooms`, `spaces`, `connections`, `bench`, `logs`, `stats`, `auth issue-ably-token`, `auth issue-jwt-token`, `auth revoke-token` |
| **Precedence** | `ABLY_TOKEN` > **`ABLY_API_KEY`** > config file > interactive prompt |

**Behavior:**

- Skips the interactive app and key selection flow. App ID is extracted from the key format.
- Suppresses the "You are not logged in" help prompt and the account/app info banner.
- No `ably accounts login` required.
- Used as a fallback when no account, app, or key is configured locally.

**Key format validation:**

The expected format is `APP_ID.KEY_ID:KEY_SECRET` (exactly one colon and one period separator). In local CLI mode, keys are accepted as-is. A malformed key produces a warning but is still attempted — the Ably SDK returns error code 40100 at connection time if invalid. Invalid keys are automatically removed from local config after a failed connection (auto-removed in JSON mode; user-prompted in interactive mode).

**Client ID behavior:**

When using `ABLY_API_KEY`, the CLI auto-generates a default client ID in the format `ably-cli-{uuid}`. Override with `--client-id <value>` or use `--client-id none` for no client ID.

**Examples:**

```shell
# Export for multiple commands
export ABLY_API_KEY="your-app-id.key-id:key-secret"
ably channels publish my-channel "Hello"

# Inline for a single command
ABLY_API_KEY="your-app-id.key-id:key-secret" ably channels subscribe my-channel
```

> **Note:** `auth keys get` displays a warning if `ABLY_API_KEY` is set to a different key than the one being viewed, informing you that the env var overrides the configured key for product API commands.

---

#### `ABLY_TOKEN`

Authenticate data plane commands with an Ably token or JWT. Has the **highest priority** of all authentication methods.

| Property | Value |
| --- | --- |
| **Format** | Ably token string or JWT string |
| **Applicable commands** | Same as `ABLY_API_KEY` (data plane commands) |
| **Precedence** | **`ABLY_TOKEN`** > `ABLY_API_KEY` > `--api-key` flag > config file |

**Behavior:**

- Token is passed directly to the Ably SDK. Skips the interactive app and key selection flow entirely.
- `--client-id` is **ignored** when `ABLY_TOKEN` is set — the client ID is embedded in the token. A warning is logged if `--client-id` is passed.
- No `ably accounts login` required.
- Silently overrides `ABLY_API_KEY` and `--api-key` flag (no conflict warning).

**Accepted formats:**

- **Ably tokens** from `auth issue-ably-token`
- **JWTs** from `auth issue-jwt-token`

No format validation — the token is passed as-is to the Ably SDK. Invalid or expired tokens fail with error code 40100.

**No token refresh:**

The CLI does not check token expiry or attempt automatic refresh. If a token expires during a long-running command (e.g., `channels subscribe`), the connection fails. For long-running commands, prefer `ABLY_API_KEY`.

**Token display:**

In the auth info banner, tokens longer than 20 characters are truncated to the first 17 characters + `...`.

**Examples:**

```shell
# Export a token
export ABLY_TOKEN="your-ably-token-or-jwt"
ably channels publish my-channel "Hello"

# Pipe token issuance into a command
ABLY_TOKEN="$(ably auth issue-ably-token --token-only)" ably channels publish my-channel "Hello"

# Issue with restricted capabilities and 1-hour TTL
ABLY_TOKEN="$(ably auth issue-ably-token --capability '{"my-channel":["publish","subscribe"]}' --ttl 3600 --token-only)" ably channels subscribe my-channel
```

> **Note:** `ABLY_TOKEN` alone does **not** suppress the "You are not logged in" help prompt (only `ABLY_ACCESS_TOKEN` and `ABLY_API_KEY` do). This does not affect command execution.

> **Important:** `ABLY_TOKEN` cannot be used to issue new tokens. The `auth issue-ably-token` command requires an API key, so `ABLY_TOKEN` is bypassed for that command.

---

#### `ABLY_ACCESS_TOKEN`

Authenticate Control API commands with an access token. Used for account-level operations.

| Property | Value |
| --- | --- |
| **Format** | OAuth 2.0 bearer token string |
| **Applicable commands** | `accounts`, `apps`, `auth keys`, `integrations`, `queues`, `push` |
| **Precedence** | **`ABLY_ACCESS_TOKEN`** > config file access token |

**Behavior:**

- If set, the CLI skips the account configuration entirely and uses this token for all Control API requests.
- Token is sent as `Authorization: Bearer <token>` in HTTP headers.
- Suppresses the "You are not logged in" help prompt.
- No `ably accounts login` required.

**No format validation:**

The CLI does not validate the token format. Validation is server-side — invalid/expired tokens return HTTP 401. The `ably accounts current` command verifies token validity and shows "Your access token may have expired" on failure, falling back to cached account info.

**App name caching:**

When used in data plane commands to fetch app names from the Control API, results are automatically cached in local config to avoid repeated API calls. If the fetch fails, "Unknown App" is shown without failing the command.

**Crossover usage in data plane commands:**

Even for data plane commands, `ABLY_ACCESS_TOKEN` is used to:
1. Resolve app names for display
2. Enable the interactive app/key selection flow when no API key is configured

If you use `ABLY_API_KEY` or `ABLY_TOKEN` without `ABLY_ACCESS_TOKEN` or a logged-in account, the CLI may show "Unknown App" in output.

**Examples:**

```shell
# List all apps
ABLY_ACCESS_TOKEN="your-token" ably apps list --json

# Create a new app
ABLY_ACCESS_TOKEN="your-token" ably apps create --name "my-new-app"
```

---

#### Authentication Resolution Order

**Data plane commands** (channels, rooms, spaces, etc.):

1. `ABLY_TOKEN` environment variable (token auth)
2. `ABLY_API_KEY` environment variable (API key auth)
3. `--api-key` flag
4. API key from logged-in account configuration (`~/.ably/config`)
5. Interactive prompt to select app and key (requires `ABLY_ACCESS_TOKEN` or logged-in account)

**Control API commands** (accounts, apps, auth keys, etc.):

1. `ABLY_ACCESS_TOKEN` environment variable
2. Access token from logged-in account configuration (`~/.ably/config`)

**Login bypass summary:**

| Variable | What it bypasses | Error on invalid credential |
| --- | --- | --- |
| `ABLY_API_KEY` | Skips interactive app/key selection. App ID extracted from key. | "Invalid API key. Ensure you have a valid key configured." (40100) |
| `ABLY_TOKEN` | Skips interactive app/key selection. Token passed directly to SDK. | "Invalid token. Please provide a valid Ably Token or JWT." (40100) |
| `ABLY_ACCESS_TOKEN` | Skips account config lookup. Token used as bearer token for Control API. | HTTP 401 from Control API |

When any auth env var is set:
- The account/app info banner is suppressed
- No `~/.ably/` config files are required

---

### App Selection

#### `ABLY_APP_ID`

Provide a default value for the `--app` flag across commands.

| Property | Value |
| --- | --- |
| **Format** | App ID (e.g., `abc123`) or app name (e.g., `My App`) |
| **Precedence** | `--app` CLI flag > **`ABLY_APP_ID`** > current app config > interactive prompt |

**Behavior:**

- Automatically used as the default value for the `--app` flag.
- Accepts both app IDs and app names. Names are resolved to IDs via the Control API.
- `--app` on the command line always takes precedence.

**Example:**

```shell
export ABLY_APP_ID="your-app-id"
ably auth keys list            # Uses ABLY_APP_ID
ably auth keys list --app other-app  # --app takes precedence
```

---

### Configuration

#### `ABLY_CLI_CONFIG_DIR`

Override the directory where the CLI stores its configuration file.

| Property | Value |
| --- | --- |
| **Format** | Directory path |
| **Default** | `~/.ably` |

The CLI stores a single `config` file (TOML format, file permission `0o600`) inside this directory containing:

- Account credentials (access tokens, account IDs, user emails)
- Current account selection
- Per-app configuration (API keys, app names, key IDs, key names)
- Current app selection
- Custom endpoint settings
- AI help conversation context

The directory is created automatically if it does not exist.

**Example:**

```shell
export ABLY_CLI_CONFIG_DIR="/path/to/custom/config"
ably accounts login
```

---

#### `ABLY_HISTORY_FILE`

Override the location of the interactive mode command history file.

| Property | Value |
| --- | --- |
| **Format** | File path |
| **Default** | `~/.ably/history` |

The history file stores one command per line. Maximum 1000 entries; when the file exceeds 2000 lines, it is automatically trimmed to the most recent 1000. History errors are non-fatal (silently ignored).

> **Note:** The `ably-interactive` shell wrapper script automatically sets `ABLY_HISTORY_FILE` to `~/.ably/history`. Only set this if you need a custom location. See [Interactive REPL](Interactive-REPL.md) for architecture details and [Troubleshooting](Troubleshooting.md#command-history-not-persisting) if history is not persisting.

**Example:**

```shell
export ABLY_HISTORY_FILE="/path/to/custom/history"
ably-interactive
```

---

### Behavioral Control

#### `ABLY_CLI_DEFAULT_DURATION`

Auto-exit long-running commands after N seconds.

| Property | Value |
| --- | --- |
| **Format** | Number (seconds). Value <= 0 is treated as "run forever". |
| **Default** | None (run forever) |
| **Precedence** | `--duration` flag > **`ABLY_CLI_DEFAULT_DURATION`** > run forever |

Affects all 28 long-running subscribe and stream commands:

- **Channels:** `subscribe`, `presence subscribe`, `occupancy subscribe`, `annotations subscribe`
- **Rooms:** `messages subscribe`, `presence subscribe`, `typing subscribe`, `reactions subscribe`, `occupancy subscribe`, `messages reactions subscribe`
- **Spaces:** `subscribe`, `members subscribe`, `locks subscribe`, `locations subscribe`, `cursors subscribe`, `occupancy subscribe`
- **Logs:** `subscribe`, `channel-lifecycle subscribe`, `connection-lifecycle subscribe`, `push subscribe`
- **Bench:** `subscriber`
- **Long-lived actions:** `enter`, `set`, `acquire`, `keystroke` commands that wait for signals

> **Testing note:** Unit and integration tests set `ABLY_CLI_DEFAULT_DURATION` to `"0.25"`, so subscribe commands auto-exit after 250ms. Do NOT pass `--duration` in tests — it overrides this fast default. See [Testing Guide](Testing.md#duration-in-tests).

**Example:**

```shell
ABLY_CLI_DEFAULT_DURATION=30 ably channels subscribe my-channel
```

---

#### `ABLY_CLI_NON_INTERACTIVE`

Skip confirmation prompts for non-interactive/automated use.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Specifically affects:
- Confirmation prompts before destructive operations
- "Did you mean...?" confirmation for mistyped commands

Does **not** affect output formatting, spinners, or other interactive features.

**Example:**

```shell
export ABLY_CLI_NON_INTERACTIVE=true
ably apps delete --app my-app --force
```

---

### Host Overrides

#### `ABLY_ENDPOINT`

Override the Ably Realtime/REST API endpoint for all data plane commands.

| Property | Value |
| --- | --- |
| **Format** | Hostname or URL (passed as-is, no normalization) |
| **Default** | Ably SDK default (not set by CLI) |
| **Precedence** | **`ABLY_ENDPOINT`** > account config endpoint > SDK default |

**Example:**

```shell
export ABLY_ENDPOINT="custom-endpoint.example.com"
ably channels publish my-channel "Hello"
```

---

#### `ABLY_CONTROL_HOST`

Override the Control API host for all account/app management commands.

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

#### `ABLY_DASHBOARD_HOST`

Override the Ably dashboard URL for commands that generate dashboard links.

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

### Running Commands Without Login (One-Shot Usage)

Environment variables enable "one-shot" command execution without any prior login, config files, or interactive prompts:

```shell
# Data plane — publish with no setup
ABLY_API_KEY="appId.keyId:keySecret" ably channels publish my-channel "Hello"

# Token auth — issue and use in one line
ABLY_TOKEN="$(ABLY_API_KEY='appId.keyId:keySecret' ably auth issue-ably-token --token-only)" ably channels subscribe my-channel

# Control API — manage apps with no login
ABLY_ACCESS_TOKEN="your-token" ably apps list --json

# Fully contextless — combine auth + app + non-interactive
export ABLY_ACCESS_TOKEN="your-token"
export ABLY_APP_ID="your-app-id"
export ABLY_CLI_NON_INTERACTIVE=true
ably auth keys list --json
```

### CI/CD Usage

Environment variables are the recommended authentication method for CI/CD pipelines:

```shell
# GitHub Actions — store secrets in repository settings
ABLY_API_KEY="${{ secrets.ABLY_API_KEY }}" ably channels publish deploy-notifications "Deployment v1.2.3 complete"
ABLY_ACCESS_TOKEN="${{ secrets.ABLY_ACCESS_TOKEN }}" ably apps list --json

# Combine with duration for scripted subscribe
ABLY_API_KEY="${{ secrets.ABLY_API_KEY }}" ABLY_CLI_DEFAULT_DURATION=10 ably channels subscribe my-channel --json

# Comprehensive workflow-level setup
export ABLY_ACCESS_TOKEN="${{ secrets.ABLY_ACCESS_TOKEN }}"
export ABLY_APP_ID="my-production-app"
export ABLY_CLI_NON_INTERACTIVE=true
ably auth keys list --json
```

---

## Development Stage Usage

These variables are for CLI contributors, development, testing, and internal modes. They are **not intended for end-user configuration** unless explicitly noted.

### Development & Debugging

#### `ABLY_SHOW_DEV_FLAGS`

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

#### `DEBUG`

Enable oclif framework debug output for diagnosing CLI internals.

| Property | Value |
| --- | --- |
| **Format** | Debug pattern (e.g., `"oclif*"`) |

When set:
- Stack traces are shown on errors in interactive mode
- `NODE_ENV` is **not** overridden to `"production"` in interactive mode
- oclif emits detailed framework-level debug output

See [Debugging Guide](Debugging.md#debugging-the-cli-locally) for more debugging techniques including Node inspector and verbose flags.

**Example:**

```shell
DEBUG=oclif* ably channels publish my-channel "test"
```

---

#### `TERMINAL_DIAGNOSTICS`

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

#### `CI`

Standard CI environment detection. Not Ably-specific.

| Property | Value |
| --- | --- |
| **Format** | Any value |

When set:
- TTY-dependent features are disabled (interactive terminal detection returns false)
- Stats display formatting may differ

---

### Testing

#### `ABLY_CLI_TEST_MODE`

Enable test mode with a mock config manager.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Used by the test harness (set automatically during test runs). Enables mock config manager and adjusts various behaviors for test isolation. See [Testing Guide](Testing.md) for test layers and auth patterns, and [E2E Testing CLI Runner](E2E-Testing-CLI-Runner.md) for E2E-specific debugging with `E2E_DEBUG` and `ABLY_CLI_TEST_SHOW_OUTPUT`.

---

#### `SKIP_CONFIRMATION`

Skip confirmation prompts. Functionally identical to `ABLY_CLI_NON_INTERACTIVE`.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Primarily used in test code. For production/CI use, prefer `ABLY_CLI_NON_INTERACTIVE`.

---

#### Test-Runner Environment Variables (Not CLI Variables)

The following env vars are used by the test runner and scripts, **not** by the CLI itself. They are documented in the [Testing Guide](Testing.md) and [E2E Testing CLI Runner](E2E-Testing-CLI-Runner.md):

| Variable | Purpose | Used by |
| --- | --- | --- |
| `E2E_ABLY_API_KEY` | API key for E2E tests against live Ably | `.env` / CI secrets |
| `E2E_ABLY_ACCESS_TOKEN` | Access token for E2E tests | `.env` / CI secrets |
| `E2E_DEBUG` | Enable detailed E2E test debugging output | Test runner |
| `ABLY_CLI_TEST_SHOW_OUTPUT` | Show CLI command output during E2E tests | Test runner |

---

### Tooling

#### `GENERATING_DOC`

Enable documentation generation mode.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

When set:
- ANSI color codes are stripped from help output
- camelCase argument names are patched to snake_case for doc headings

Set automatically by the `pnpm generate-doc` script.

---

### Internal Variables (Set Programmatically)

These env vars are set by the CLI itself during execution. They should not be set manually.

#### `ABLY_INTERACTIVE_MODE`

Signals that the CLI is running in interactive shell mode.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Behavioral changes when set:
- Help system throws errors instead of exiting the process
- Command examples show `ably> ` prefix instead of `$ ably `
- SIGINT: special double Ctrl+C detection for force quit (see [Exit Codes](Exit-Codes.md) for exit code details)
- Cleanup timeout capped at 4.5 seconds
- `did-you-mean` suggestion format changes
- Version flag throws `EEXIT` error instead of exiting
- `status` and `support ask` commands adjust spinner behavior

See [Interactive REPL](Interactive-REPL.md) for the full architecture and [Troubleshooting](Troubleshooting.md#interactive-mode-issues) for common issues.

---

#### `ABLY_WRAPPER_MODE`

Signals the interactive shell is running under the `ably-interactive` wrapper script.

| Property | Value |
| --- | --- |
| **Format** | `"1"` |

The wrapper script restarts the CLI after Ctrl+C interruptions and uses exit code 42 to detect user-initiated exits. See [Interactive REPL](Interactive-REPL.md) for wrapper script details and [Exit Codes](Exit-Codes.md#wrapper-script-behavior) for exit code behavior.

---

#### `ABLY_SUPPRESS_WELCOME`

Suppress the welcome logo on subsequent interactive mode restarts.

| Property | Value |
| --- | --- |
| **Format** | `"1"` |

The wrapper script sets this after the first run so the logo only appears once per session.

---

#### `ABLY_WEB_CLI_MODE`

Signals the CLI is running in a web browser terminal. See [Interactive REPL](Interactive-REPL.md) for the web CLI architecture and motivation.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

**Restricted commands (14 patterns):**

`accounts:current`, `accounts:list`, `accounts:login`, `login`, `accounts:logout`, `accounts:switch`, `apps:create`, `apps:switch`, `apps:delete`, `auth:keys:switch`, `autocomplete*`, `config*`, `push:config:set-apns`, `push:config:set-fcm`

These commands are blocked because auth and app context are managed by the web UI, not the CLI.

---

#### `ABLY_ANONYMOUS_USER_MODE`

Signals anonymous web CLI mode with a heavily restricted command set.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

**Restricted commands (15 patterns, 25+ commands):**

`accounts*`, `apps*`, `auth:keys*`, `auth:revoke-token`, `bench*`, `channels:list`, `channels:logs`, `connections:logs`, `rooms:list`, `spaces:list`, `logs*`, `integrations*`, `queues*`, `push*`, `stats*`

Pattern matching: Exact match OR prefix match (patterns ending with `*` match command ID prefix).

---

#### `ABLY_CURRENT_COMMAND`

Tracks the currently executing command ID for interrupt feedback and signal handling.

| Property | Value |
| --- | --- |
| **Format** | Command ID string (e.g., `channels:subscribe`) |

---

#### `NODE_ENV`

Set to `"production"` in interactive mode to suppress oclif error stack traces.

| Property | Value |
| --- | --- |
| **Format** | `"production"` |

Only set when `DEBUG` is not active.

---

## Commands by Auth Type

### Data Plane (`ABLY_API_KEY` / `ABLY_TOKEN`)

| Command group | Subcommands |
| --- | --- |
| `channels` | publish, subscribe, list, history, occupancy, inspect, presence, annotations |
| `rooms` | messages, presence, typing, reactions, occupancy |
| `spaces` | locks, cursors, members, locations, occupancy |
| `connections` | list |
| `bench` | publish, subscribe |
| `logs` | channel-lifecycle, connection-lifecycle, push |
| `stats` | (all) |
| `auth` | issue-ably-token, issue-jwt-token, revoke-token |

### Control API (`ABLY_ACCESS_TOKEN`)

| Command group | Subcommands |
| --- | --- |
| `accounts` | login, switch, list, current, logout |
| `apps` | list, create, delete, update, current, switch |
| `auth keys` | list, create, update, revoke, switch, current, get |
| `integrations` | list, create, delete, update |
| `queues` | list, create, delete |
| `push` | device registrations, channel subscriptions, config |

### Hybrid

Any data plane command when no API key is configured triggers the interactive app/key selection flow, which uses `ABLY_ACCESS_TOKEN` (or a logged-in account) to call the Control API.

---

## Source Code Reference

> **Note:** This section is primarily intended for use by LLMs and LLM agents to cross-verify environment variable usage against the source code. Human developers can use `grep` to find these references directly.

| Source File | Variables |
| --- | --- |
| `src/base-command.ts` | `ABLY_TOKEN`, `ABLY_API_KEY`, `ABLY_ACCESS_TOKEN`, `ABLY_CONTROL_HOST`, `ABLY_ENDPOINT`, `ABLY_ANONYMOUS_USER_MODE`, `ABLY_INTERACTIVE_MODE`, `ABLY_CURRENT_COMMAND`, `CI` |
| `src/control-base-command.ts` | `ABLY_ACCESS_TOKEN` |
| `src/services/config-manager.ts` | `ABLY_CLI_CONFIG_DIR`, `ABLY_API_KEY` |
| `src/services/history-manager.ts` | `ABLY_HISTORY_FILE` |
| `src/flags.ts` | `ABLY_SHOW_DEV_FLAGS`, `ABLY_CONTROL_HOST`, `ABLY_DASHBOARD_HOST` |
| `src/commands/auth/*.ts` (12 files) | `ABLY_APP_ID` |
| `src/utils/long-running.ts` | `ABLY_CLI_DEFAULT_DURATION` |
| `src/utils/web-mode.ts` | `ABLY_WEB_CLI_MODE` |
| `src/utils/test-mode.ts` | `ABLY_CLI_TEST_MODE` |
| `src/utils/terminal-diagnostics.ts` | `TERMINAL_DIAGNOSTICS` |
| `src/utils/interrupt-feedback.ts` | `ABLY_CURRENT_COMMAND` |
| `src/commands/interactive.ts` | `ABLY_INTERACTIVE_MODE`, `ABLY_WRAPPER_MODE`, `ABLY_SUPPRESS_WELCOME`, `DEBUG`, `NODE_ENV` |
| `src/base-topic-command.ts` | `ABLY_INTERACTIVE_MODE`, `ABLY_CLI_NON_INTERACTIVE`, `SKIP_CONFIRMATION`, `ABLY_ANONYMOUS_USER_MODE` |
| `src/hooks/command_not_found/did-you-mean.ts` | `ABLY_INTERACTIVE_MODE`, `ABLY_CLI_NON_INTERACTIVE`, `SKIP_CONFIRMATION` |
| `src/help.ts` | `ABLY_INTERACTIVE_MODE`, `ABLY_ANONYMOUS_USER_MODE`, `ABLY_ACCESS_TOKEN`, `ABLY_API_KEY`, `GENERATING_DOC` |
| `src/hooks/init/patch-arg-names.ts` | `GENERATING_DOC` |
| `src/services/stats-display.ts` | `CI` |

---

## Related

- [Debugging Guide](Debugging.md) — Debugging tips including `DEBUG` and terminal diagnostics
- [Testing Guide](Testing.md) — Test layers, auth in tests, duration defaults, and test-specific env vars (`E2E_DEBUG`, `ABLY_CLI_TEST_SHOW_OUTPUT`)
- [E2E Testing CLI Runner](E2E-Testing-CLI-Runner.md) — E2E test runner debugging flags and env vars
- [Interactive REPL](Interactive-REPL.md) — Interactive mode architecture, wrapper script, and history persistence
- [Troubleshooting](Troubleshooting.md) — Common issues with env vars, history, and configuration
- [Exit Codes](Exit-Codes.md) — Exit codes used in interactive mode and wrapper script behavior
- [Project Structure](Project-Structure.md) — Repository layout and source file organization
- [Auto-completion](Auto-completion.md) — Shell tab completion setup (`ABLY_SHOW_DEV_FLAGS` affects hidden flag visibility)
