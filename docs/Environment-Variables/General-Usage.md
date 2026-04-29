# Environment Variables — General Usage

These environment variables are most commonly used during development as well as by end users in CI/CD pipelines, scripts, and production use.

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
| [`ABLY_CLI_NON_INTERACTIVE`](#ably_cli_non_interactive) | Behavior | Auto-confirm "Did you mean?" prompts | Not set |
| [`ABLY_ENDPOINT`](#ably_endpoint) | Host Override | Override Realtime/REST API endpoint | SDK default |

> For development, testing, debugging, and internal variables, see [Development Stage Usage](Development-Usage.md).

---

## Authentication

### `ABLY_API_KEY`

Authenticate data plane commands with an Ably API key. Bypasses the login workflow entirely.

| Property | Value |
| --- | --- |
| **Format** | `APP_ID.KEY_ID:KEY_SECRET` |
| **Applicable commands** | `channels`, `rooms`, `spaces`, `connections`, `bench`, `logs`, `auth issue-ably-token`, `auth issue-jwt-token`, `auth revoke-token` |
| **Precedence** | `ABLY_TOKEN` > **`ABLY_API_KEY`** > config file > interactive prompt |

**Behavior:**

- Skips the interactive app and key selection flow. App ID is extracted from the key format.
- Suppresses the "You are not logged in" help prompt and the account/app info banner.
- No `ably accounts login` required.
- Used as a fallback when no account, app, or key is configured locally.

**Obtaining an API key:**

Create and manage API keys from the [API Keys](https://ably.com/accounts/any/apps/any/app_keys) tab in the Ably dashboard, or programmatically via the [Control API](https://ably.com/docs/platform/account/control-api). Each key has configurable [capabilities](https://ably.com/docs/auth/capabilities) (publish, subscribe, history, presence, channel metadata, push, statistics, privileged headers) and optional resource restrictions to limit access to specific channels or queues. See the [API keys documentation](https://ably.com/docs/platform/account/app/api) for full details, and the [authentication overview](https://ably.com/docs/auth) for key format breakdown and security guidance.

**Key format validation:**

The expected format is `APP_ID.KEY_ID:KEY_SECRET` (exactly one colon and one period separator). In local CLI mode, keys are accepted without format validation. In web CLI mode, a malformed key produces a warning but is still attempted. In both cases, the Ably SDK returns error code 40100 at connection time if the key is invalid. Keys stored in local config (not env vars) are automatically removed after a failed connection (auto-removed in JSON mode; user-prompted in interactive mode).

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

### `ABLY_TOKEN`

Authenticate data plane commands with an Ably token or JWT. Has the **highest priority** of all authentication methods.

| Property | Value |
| --- | --- |
| **Format** | Ably token string or JWT string |
| **Applicable commands** | Same as `ABLY_API_KEY` (data plane commands) |
| **Precedence** | **`ABLY_TOKEN`** > `ABLY_API_KEY` > config file > interactive prompt |

**Behavior:**

- Token is passed directly to the Ably SDK. Skips the interactive app and key selection flow entirely.
- `--client-id` is **ignored** when `ABLY_TOKEN` is set — the client ID is embedded in the token. A warning is logged if `--client-id` is passed.
- No `ably accounts login` required.
- Silently overrides `ABLY_API_KEY` and any configured API key (no conflict warning).

**Obtaining a token:**

Issue tokens using the CLI itself or any Ably SDK. The CLI provides two commands: `ably auth issue-ably-token` for native Ably tokens and `ably auth issue-jwt-token` for JWTs. Both support `--capability`, `--client-id`, and `--ttl` options, and `--token-only` for piping into other commands. JWTs are the [recommended token format](https://ably.com/docs/auth/token) for most applications — they are stateless, require no Ably SDK on the server, and support [channel-scoped claims](https://ably.com/docs/auth/token/jwt#channel-claims). Ably tokens are the [legacy alternative](https://ably.com/docs/auth/token/ably-tokens) when JWTs are not suitable. See the [token authentication documentation](https://ably.com/docs/auth/token) for TTL limits (max 24 hours; max 1 hour for revocable tokens), token refresh flows, and security guidance.

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

> **Important:** `ABLY_TOKEN` cannot be used to issue new tokens. The `auth issue-ably-token` command requires an API key. Since `ABLY_TOKEN` has the highest auth priority, it overrides any API key in the client options. If `ABLY_TOKEN` is set while issuing tokens, unset it first or the token issuance will fail: `unset ABLY_TOKEN && ably auth issue-ably-token`.

---

### `ABLY_ACCESS_TOKEN`

Authenticate Control API commands with an access token. Used for account-level operations.

| Property | Value |
| --- | --- |
| **Format** | OAuth 2.0 bearer token string |
| **Applicable commands** | `accounts`, `apps`, `auth keys`, `integrations`, `queues`, `push`, `stats` |
| **Precedence** | **`ABLY_ACCESS_TOKEN`** > config file access token |

**Behavior:**

- If set, the CLI skips the account configuration entirely and uses this token for all Control API requests.
- Token is sent as `Authorization: Bearer <token>` in HTTP headers.
- Suppresses the "You are not logged in" help prompt.
- No `ably accounts login` required.

**Obtaining an access token:**

Create and manage access tokens from the [Access tokens](https://ably.com/users/access_tokens) page in the Ably dashboard, or use `ably accounts login` which creates one automatically. Tokens have configurable capabilities (read/write permissions for apps, keys, rules, queues, namespaces, and statistics) and expiration periods (30, 60, 90 days, or no expiration). See the [Access tokens documentation](https://ably.com/docs/platform/account/access-tokens) for details on capabilities, expiration, rotation, and revocation.

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
ABLY_ACCESS_TOKEN="your-token" ably apps create "my-new-app"
```

---

### Authentication Resolution Order

**Data plane commands** (channels, rooms, spaces, etc.):

1. `ABLY_TOKEN` environment variable (token auth)
2. `ABLY_API_KEY` environment variable (API key auth)
3. API key from logged-in account configuration (`~/.ably/config`)
4. Interactive prompt to select app and key (requires `ABLY_ACCESS_TOKEN` or logged-in account)

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

## App Selection

### `ABLY_APP_ID`

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

## Configuration

### `ABLY_CLI_CONFIG_DIR`

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

### `ABLY_HISTORY_FILE`

Override the location of the interactive mode command history file.

| Property | Value |
| --- | --- |
| **Format** | File path |
| **Default** | `~/.ably/history` |

The history file stores one command per line. Maximum 1000 entries; when the file exceeds 2000 lines, it is automatically trimmed to the most recent 1000. History errors are non-fatal (silently ignored).

> **Note:** The `ably-interactive` shell wrapper script automatically sets `ABLY_HISTORY_FILE` to `~/.ably/history`. Only set this if you need a custom location. See [Interactive REPL](../Interactive-REPL.md) for architecture details and [Troubleshooting](../Troubleshooting.md#command-history-not-persisting) if history is not persisting.

**Example:**

```shell
export ABLY_HISTORY_FILE="/path/to/custom/history"
ably-interactive
```

---

## Behavioral Control

### `ABLY_CLI_DEFAULT_DURATION`

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

> **Testing note:** Unit and integration tests set `ABLY_CLI_DEFAULT_DURATION` to `"0.25"`, so subscribe commands auto-exit after 250ms. Do NOT pass `--duration` in tests — it overrides this fast default. See [Testing Guide](../Testing.md#duration-in-tests).

**Example:**

```shell
ABLY_CLI_DEFAULT_DURATION=30 ably channels subscribe my-channel
```

---

### `ABLY_CLI_NON_INTERACTIVE`

Skip confirmation prompts for non-interactive/automated use.

| Property | Value |
| --- | --- |
| **Format** | `"true"` |

Specifically affects:
- "Did you mean...?" confirmation for mistyped commands (auto-confirms the suggestion)
- Topic command disambiguation when a parent command is invoked directly

Does **not** affect destructive operation prompts (those require the `--force` flag), output formatting, spinners, or other interactive features.

**Example:**

```shell
# Auto-confirms "Did you mean...?" suggestions without prompting
export ABLY_CLI_NON_INTERACTIVE=true
ably chanels publish my-channel "Hello"  # Typo auto-corrects to "channels publish"
```

---

## Host Overrides

### `ABLY_ENDPOINT`

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

## Running Commands Without Login (One-Shot Usage)

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

## CI/CD Usage

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

## Commands by Auth Type

### Data Plane (`ABLY_API_KEY` / `ABLY_TOKEN`)

| Command group | Subcommands |
| --- | --- |
| `channels` | publish, subscribe, list, history, occupancy, inspect, presence, annotations |
| `rooms` | messages, presence, typing, reactions, occupancy |
| `spaces` | locks, cursors, members, locations, occupancy |
| `connections` | test |
| `bench` | publish, subscribe |
| `logs` | channel-lifecycle, connection-lifecycle, push |
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
| `stats` | app, account |

### Hybrid

Any data plane command when no API key is configured triggers the interactive app/key selection flow, which uses `ABLY_ACCESS_TOKEN` (or a logged-in account) to call the Control API.

---

## Related

- [Development Stage Usage](Development-Usage.md) — Variables for CLI contributors, testing, debugging, and internal modes
- [Debugging Guide](../Debugging.md) — Debugging tips including `DEBUG` and terminal diagnostics
- [Testing Guide](../Testing.md) — Test layers, auth in tests, duration defaults, and test-specific env vars
- [Troubleshooting](../Troubleshooting.md) — Common issues with env vars, history, and configuration
- [Authentication overview](https://ably.com/docs/auth) — API key format, basic vs token auth, and security guidance
- [API keys](https://ably.com/docs/platform/account/app/api) — Create and manage API keys in the dashboard
- [Token authentication](https://ably.com/docs/auth/token) — Token auth flows, TTL limits, and token refresh
- [JWTs](https://ably.com/docs/auth/token/jwt) — JWT creation, claims, channel-scoped claims, and per-connection rate limits
- [Capabilities](https://ably.com/docs/auth/capabilities) — Capability operations and wildcard syntax for keys and tokens
- [Access tokens](https://ably.com/docs/platform/account/access-tokens) — Create, manage, rotate, and revoke access tokens for the Control API and CLI
- [Control API](https://ably.com/docs/platform/account/control-api) — Control API authentication and usage reference
- [Ably CLI](https://ably.com/docs/platform/tools/cli) — Official CLI documentation including authentication setup
