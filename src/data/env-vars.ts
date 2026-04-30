// Single source of truth for the env-var reference shown by `ably env`.
// Mirrors docs/Environment-Variables/General-Usage.md, with internal-doc
// cross-links stripped (this content is rendered in the CLI, which must
// not point users at filesystem paths inside the repo).
//
// Editing convention:
//   - Plain strings only. No chalk, no template helpers.
//   - Inline `code-spans` use backticks; the renderer wraps them in cyan.
//   - Variable order and detail order matter: rendering follows array order.

export type EnvVarCategory =
  | "Authentication"
  | "App Selection"
  | "Configuration"
  | "Behavioral Control"
  | "Host Override";

export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: readonly string[] }
  | { kind: "numbered"; items: readonly string[] }
  | { kind: "code"; lines: readonly string[] }
  | { kind: "note"; text: string }
  | { kind: "important"; text: string }
  | {
      kind: "table";
      headers: readonly string[];
      rows: readonly (readonly string[])[];
    };

export class DetailSection {
  constructor(
    public readonly heading: string,
    public readonly blocks: readonly Block[],
  ) {}
}

export class Example {
  constructor(
    public readonly description: string,
    public readonly lines: readonly string[],
  ) {}
}

export class EnvVarEntry {
  constructor(
    public readonly name: string,
    public readonly category: EnvVarCategory,
    public readonly purpose: string,
    public readonly format: string,
    public readonly default_: string,
    public readonly precedence: string | null,
    public readonly appliesTo: readonly string[],
    public readonly intro: string,
    public readonly example: Example,
    public readonly details: readonly DetailSection[],
  ) {}
}

export class CrossCuttingSection {
  constructor(
    public readonly heading: string,
    public readonly blocks: readonly Block[],
  ) {}
}

export class RelatedLink {
  constructor(
    public readonly text: string,
    public readonly url: string,
    public readonly blurb: string,
  ) {}
}

export interface Prerequisite {
  label: string;
  commands: readonly string[];
  authVars: readonly string[];
}

export class EnvVarsData {
  constructor(
    public readonly meta: {
      lede: string;
      note: string;
      prerequisites: readonly Prerequisite[];
    },
    public readonly variables: readonly EnvVarEntry[],
    public readonly crossCutting: {
      authResolutionOrder: CrossCuttingSection;
      oneShotUsage: CrossCuttingSection;
      cicdUsage: CrossCuttingSection;
      commandsByAuthType: CrossCuttingSection;
    },
    public readonly relatedLinks: readonly RelatedLink[],
  ) {}
}

const ABLY_API_KEY = new EnvVarEntry(
  "ABLY_API_KEY",
  "Authentication",
  "API key for data plane commands",
  "APP_ID.KEY_ID:KEY_SECRET",
  "None",
  "`ABLY_TOKEN` > **`ABLY_API_KEY`** > config file > interactive prompt",
  [
    "channels",
    "rooms",
    "spaces",
    "connections",
    "bench",
    "logs",
    "auth issue-ably-token",
    "auth issue-jwt-token",
    "auth revoke-token",
  ],
  "Authenticate data plane commands with an Ably API key. Bypasses the login workflow entirely.",
  new Example("Authenticate data plane commands with an Ably API key.", [
    `export ABLY_API_KEY="your-app-id.key-id:key-secret"`,
    `ably channels publish my-channel "Hello"`,
  ]),
  [
    new DetailSection("Behavior", [
      {
        kind: "bullets",
        items: [
          "Skips the interactive app and key selection flow. App ID is extracted from the key format.",
          'Suppresses the "You are not logged in" help prompt and the account/app info banner.',
          "No `ably accounts login` required.",
          "Used as a fallback when no account, app, or key is configured locally.",
        ],
      },
    ]),
    new DetailSection("Obtaining an API key", [
      {
        kind: "paragraph",
        text: "Create and manage API keys from the API Keys tab in the Ably dashboard (https://ably.com/accounts/any/apps/any/app_keys), or programmatically via the Control API (https://ably.com/docs/platform/account/control-api). Each key has configurable capabilities (publish, subscribe, history, presence, channel metadata, push, statistics, privileged headers) and optional resource restrictions to limit access to specific channels or queues. See the API keys documentation (https://ably.com/docs/platform/account/app/api) for full details, and the authentication overview (https://ably.com/docs/auth) for key format breakdown and security guidance.",
      },
    ]),
    new DetailSection("Key format validation", [
      {
        kind: "paragraph",
        text: "The expected format is `APP_ID.KEY_ID:KEY_SECRET` (exactly one colon and one period separator). In local CLI mode, keys are accepted without format validation. In web CLI mode, a malformed key produces a warning but is still attempted. In both cases, the Ably SDK returns error code 40100 at connection time if the key is invalid. Keys stored in local config (not env vars) are automatically removed after a failed connection (auto-removed in JSON mode; user-prompted in interactive mode).",
      },
    ]),
    new DetailSection("Client ID behavior", [
      {
        kind: "paragraph",
        text: "When using `ABLY_API_KEY`, the CLI auto-generates a default client ID in the format `ably-cli-{uuid}`. Override with `--client-id <value>` or use `--client-id none` for no client ID.",
      },
    ]),
    new DetailSection("Examples", [
      {
        kind: "code",
        lines: [
          "# Export for multiple commands",
          `export ABLY_API_KEY="your-app-id.key-id:key-secret"`,
          `ably channels publish my-channel "Hello"`,
          "",
          "# Inline for a single command",
          `ABLY_API_KEY="your-app-id.key-id:key-secret" ably channels subscribe my-channel`,
        ],
      },
    ]),
    new DetailSection("", [
      {
        kind: "note",
        text: "`auth keys get` displays a warning if `ABLY_API_KEY` is set to a different key than the one being viewed, informing you that the env var overrides the configured key for product API commands.",
      },
    ]),
  ],
);

const ABLY_TOKEN = new EnvVarEntry(
  "ABLY_TOKEN",
  "Authentication",
  "Token/JWT for data plane commands",
  "Ably token string or JWT string",
  "None",
  "**`ABLY_TOKEN`** > `ABLY_API_KEY` > config file > interactive prompt",
  ["channels", "rooms", "spaces", "connections", "bench", "logs"],
  "Authenticate data plane commands with an Ably token or JWT. Has the **highest priority** of all authentication methods.",
  new Example(
    "Authenticate data plane commands with an Ably token or JWT (**highest priority**).",
    [
      `export ABLY_TOKEN="$(ably auth issue-ably-token --token-only)"`,
      `ably channels subscribe my-channel`,
    ],
  ),
  [
    new DetailSection("Behavior", [
      {
        kind: "bullets",
        items: [
          "Token is passed directly to the Ably SDK. Skips the interactive app and key selection flow entirely.",
          "`--client-id` is ignored when `ABLY_TOKEN` is set — the client ID is embedded in the token. A warning is logged if `--client-id` is passed.",
          "No `ably accounts login` required.",
          "Silently overrides `ABLY_API_KEY` and any configured API key (no conflict warning).",
        ],
      },
    ]),
    new DetailSection("Obtaining a token", [
      {
        kind: "paragraph",
        text: "Issue tokens using the CLI itself or any Ably SDK. The CLI provides two commands: `ably auth issue-ably-token` for native Ably tokens and `ably auth issue-jwt-token` for JWTs. Both support `--capability`, `--client-id`, and `--ttl` options, and `--token-only` for piping into other commands. JWTs are the recommended token format (https://ably.com/docs/auth/token) for most applications — they are stateless, require no Ably SDK on the server, and support channel-scoped claims (https://ably.com/docs/auth/token/jwt#channel-claims). Ably tokens are the legacy alternative (https://ably.com/docs/auth/token/ably-tokens) when JWTs are not suitable. See the token authentication documentation (https://ably.com/docs/auth/token) for TTL limits (max 24 hours; max 1 hour for revocable tokens), token refresh flows, and security guidance.",
      },
    ]),
    new DetailSection("Accepted formats", [
      {
        kind: "bullets",
        items: [
          "Ably tokens from `auth issue-ably-token`",
          "JWTs from `auth issue-jwt-token`",
        ],
      },
      {
        kind: "paragraph",
        text: "No format validation — the token is passed as-is to the Ably SDK. Invalid or expired tokens fail with error code 40100.",
      },
    ]),
    new DetailSection("No token refresh", [
      {
        kind: "paragraph",
        text: "The CLI does not check token expiry or attempt automatic refresh. If a token expires during a long-running command (e.g., `channels subscribe`), the connection fails. For long-running commands, prefer `ABLY_API_KEY`.",
      },
    ]),
    new DetailSection("Token display", [
      {
        kind: "paragraph",
        text: "In the auth info banner, tokens longer than 20 characters are truncated to the first 17 characters + `...`.",
      },
    ]),
    new DetailSection("Examples", [
      {
        kind: "code",
        lines: [
          "# Export a token",
          `export ABLY_TOKEN="your-ably-token-or-jwt"`,
          `ably channels publish my-channel "Hello"`,
          "",
          "# Pipe token issuance into a command",
          `ABLY_TOKEN="$(ably auth issue-ably-token --token-only)" ably channels publish my-channel "Hello"`,
          "",
          "# Issue with restricted capabilities and 1-hour TTL",
          `ABLY_TOKEN="$(ably auth issue-ably-token --capability '{"my-channel":["publish","subscribe"]}' --ttl 3600 --token-only)" ably channels subscribe my-channel`,
        ],
      },
    ]),
    new DetailSection("", [
      {
        kind: "note",
        text: '`ABLY_TOKEN` alone does not suppress the "You are not logged in" help prompt (only `ABLY_ACCESS_TOKEN` and `ABLY_API_KEY` do). This does not affect command execution.',
      },
      {
        kind: "important",
        text: "`ABLY_TOKEN` cannot be used to issue new tokens. The `auth issue-ably-token` command requires an API key. Since `ABLY_TOKEN` has the highest auth priority, it overrides any API key in the client options. If `ABLY_TOKEN` is set while issuing tokens, unset it first or the token issuance will fail: `unset ABLY_TOKEN && ably auth issue-ably-token`.",
      },
    ]),
  ],
);

const ABLY_ACCESS_TOKEN = new EnvVarEntry(
  "ABLY_ACCESS_TOKEN",
  "Authentication",
  "Access token for Control API commands",
  "OAuth 2.0 bearer token string",
  "None",
  "**`ABLY_ACCESS_TOKEN`** > config file access token",
  ["accounts", "apps", "auth keys", "integrations", "queues", "push", "stats"],
  "Authenticate Control API commands with an access token. Used for account-level operations.",
  new Example("Authenticate Control API commands with an access token.", [
    `export ABLY_ACCESS_TOKEN="your-token"`,
    `ably apps list --json`,
  ]),
  [
    new DetailSection("Behavior", [
      {
        kind: "bullets",
        items: [
          "If set, the CLI skips the account configuration entirely and uses this token for all Control API requests.",
          "Token is sent as `Authorization: Bearer <token>` in HTTP headers.",
          'Suppresses the "You are not logged in" help prompt.',
          "No `ably accounts login` required.",
        ],
      },
    ]),
    new DetailSection("Obtaining an access token", [
      {
        kind: "paragraph",
        text: "Create and manage access tokens from the Access tokens page (https://ably.com/users/access_tokens) in the Ably dashboard, or use `ably accounts login` which creates one automatically. Tokens have configurable capabilities (read/write permissions for apps, keys, rules, queues, namespaces, and statistics) and expiration periods (30, 60, 90 days, or no expiration). See the Access tokens documentation (https://ably.com/docs/platform/account/access-tokens) for details on capabilities, expiration, rotation, and revocation.",
      },
    ]),
    new DetailSection("No format validation", [
      {
        kind: "paragraph",
        text: 'The CLI does not validate the token format. Validation is server-side — invalid/expired tokens return HTTP 401. The `ably accounts current` command verifies token validity and shows "Your access token may have expired" on failure, falling back to cached account info.',
      },
    ]),
    new DetailSection("App name caching", [
      {
        kind: "paragraph",
        text: 'When used in data plane commands to fetch app names from the Control API, results are automatically cached in local config to avoid repeated API calls. If the fetch fails, "Unknown App" is shown without failing the command.',
      },
    ]),
    new DetailSection("Crossover usage in data plane commands", [
      {
        kind: "paragraph",
        text: "Even for data plane commands, `ABLY_ACCESS_TOKEN` is used to:",
      },
      {
        kind: "numbered",
        items: [
          "Resolve app names for display",
          "Enable the interactive app/key selection flow when no API key is configured",
        ],
      },
      {
        kind: "paragraph",
        text: 'If you use `ABLY_API_KEY` or `ABLY_TOKEN` without `ABLY_ACCESS_TOKEN` or a logged-in account, the CLI may show "Unknown App" in output.',
      },
    ]),
    new DetailSection("Examples", [
      {
        kind: "code",
        lines: [
          "# List all apps",
          `ABLY_ACCESS_TOKEN="your-token" ably apps list --json`,
          "",
          "# Create a new app",
          `ABLY_ACCESS_TOKEN="your-token" ably apps create "my-new-app"`,
        ],
      },
    ]),
  ],
);

const ABLY_APP_ID = new EnvVarEntry(
  "ABLY_APP_ID",
  "App Selection",
  "Default app for `--app` flag",
  "App ID (e.g., `abc123`) or app name (e.g., `My App`)",
  "None",
  "`--app` CLI flag > **`ABLY_APP_ID`** > current app config > interactive prompt",
  ["any command accepting --app"],
  "Provide a default value for the `--app` flag across commands.",
  new Example("Provide a default value for the `--app` flag across commands.", [
    `export ABLY_APP_ID="your-app-id"`,
    `ably auth keys list`,
  ]),
  [
    new DetailSection("Behavior", [
      {
        kind: "bullets",
        items: [
          "Automatically used as the default value for the `--app` flag.",
          "Accepts both app IDs and app names. Names are resolved to IDs via the Control API.",
          "`--app` on the command line always takes precedence.",
        ],
      },
    ]),
    new DetailSection("Example", [
      {
        kind: "code",
        lines: [
          `export ABLY_APP_ID="your-app-id"`,
          `ably auth keys list            # Uses ABLY_APP_ID`,
          `ably auth keys list --app other-app  # --app takes precedence`,
        ],
      },
    ]),
  ],
);

const ABLY_CLI_CONFIG_DIR = new EnvVarEntry(
  "ABLY_CLI_CONFIG_DIR",
  "Configuration",
  "Custom config directory",
  "Directory path",
  "~/.ably",
  null,
  ["all commands"],
  "Override the directory where the CLI stores its configuration file.",
  new Example(
    "Override the directory where the CLI stores its configuration file.",
    [
      `export ABLY_CLI_CONFIG_DIR="/path/to/custom/config"`,
      `ably accounts login`,
    ],
  ),
  [
    new DetailSection("", [
      {
        kind: "paragraph",
        text: "The CLI stores a single `config` file (TOML format, file permission `0o600`) inside this directory containing:",
      },
      {
        kind: "bullets",
        items: [
          "Account credentials (access tokens, account IDs, user emails)",
          "Current account selection",
          "Per-app configuration (API keys, app names, key IDs, key names)",
          "Current app selection",
          "Custom endpoint settings",
          "AI help conversation context",
        ],
      },
      {
        kind: "paragraph",
        text: "The directory is created automatically if it does not exist.",
      },
    ]),
    new DetailSection("Example", [
      {
        kind: "code",
        lines: [
          `export ABLY_CLI_CONFIG_DIR="/path/to/custom/config"`,
          `ably accounts login`,
        ],
      },
    ]),
  ],
);

const ABLY_HISTORY_FILE = new EnvVarEntry(
  "ABLY_HISTORY_FILE",
  "Configuration",
  "Custom history file location",
  "File path",
  "~/.ably/history",
  null,
  ["ably-interactive"],
  "Override the location of the interactive mode command history file.",
  new Example(
    "Override the location of the interactive mode command history file.",
    [`export ABLY_HISTORY_FILE="/path/to/custom/history"`, `ably-interactive`],
  ),
  [
    new DetailSection("", [
      {
        kind: "paragraph",
        text: "The history file stores one command per line. Maximum 1000 entries; when the file exceeds 2000 lines, it is automatically trimmed to the most recent 1000. History errors are non-fatal (silently ignored).",
      },
      {
        kind: "note",
        text: "The `ably-interactive` shell wrapper script automatically sets `ABLY_HISTORY_FILE` to `~/.ably/history`. Only set this if you need a custom location.",
      },
    ]),
    new DetailSection("Example", [
      {
        kind: "code",
        lines: [
          `export ABLY_HISTORY_FILE="/path/to/custom/history"`,
          `ably-interactive`,
        ],
      },
    ]),
  ],
);

const ABLY_CLI_DEFAULT_DURATION = new EnvVarEntry(
  "ABLY_CLI_DEFAULT_DURATION",
  "Behavioral Control",
  "Auto-exit long-running commands (seconds)",
  'Number (seconds). Value <= 0 is treated as "run forever".',
  "None (forever)",
  "`--duration` flag > **`ABLY_CLI_DEFAULT_DURATION`** > run forever",
  ["subscribe", "stream", "enter", "set", "acquire"],
  "Auto-exit long-running commands after N seconds.",
  new Example("Auto-exit long-running commands after N seconds.", [
    `ABLY_CLI_DEFAULT_DURATION=30 ably channels subscribe my-channel`,
  ]),
  [
    new DetailSection("", [
      {
        kind: "paragraph",
        text: "Affects all 28 long-running subscribe and stream commands:",
      },
      {
        kind: "bullets",
        items: [
          "**Channels:** `subscribe`, `presence subscribe`, `occupancy subscribe`, `annotations subscribe`",
          "**Rooms:** `messages subscribe`, `presence subscribe`, `typing subscribe`, `reactions subscribe`, `occupancy subscribe`, `messages reactions subscribe`",
          "**Spaces:** `subscribe`, `members subscribe`, `locks subscribe`, `locations subscribe`, `cursors subscribe`, `occupancy subscribe`",
          "**Logs:** `subscribe`, `channel-lifecycle subscribe`, `connection-lifecycle subscribe`, `push subscribe`",
          "**Bench:** `subscriber`",
          "**Long-lived actions:** `enter`, `set`, `acquire`, `keystroke` commands that wait for signals",
        ],
      },
    ]),
    new DetailSection("Example", [
      {
        kind: "code",
        lines: [
          `ABLY_CLI_DEFAULT_DURATION=30 ably channels subscribe my-channel`,
        ],
      },
    ]),
  ],
);

const ABLY_CLI_NON_INTERACTIVE = new EnvVarEntry(
  "ABLY_CLI_NON_INTERACTIVE",
  "Behavioral Control",
  'Auto-confirm "Did you mean?" prompts',
  '`"true"`',
  "Not set",
  null,
  ["all commands"],
  "Skip confirmation prompts for non-interactive/automated use.",
  new Example("Skip confirmation prompts for non-interactive/automated use.", [
    `export ABLY_CLI_NON_INTERACTIVE=true`,
    `ably chanels publish my-channel "Hello"  # Typo auto-corrects`,
  ]),
  [
    new DetailSection("", [
      { kind: "paragraph", text: "Specifically affects:" },
      {
        kind: "bullets",
        items: [
          '"Did you mean...?" confirmation for mistyped commands (auto-confirms the suggestion)',
          "Topic command disambiguation when a parent command is invoked directly",
        ],
      },
      {
        kind: "paragraph",
        text: "Does not affect destructive operation prompts (those require the `--force` flag), output formatting, spinners, or other interactive features.",
      },
    ]),
    new DetailSection("Example", [
      {
        kind: "code",
        lines: [
          '# Auto-confirms "Did you mean...?" suggestions without prompting',
          `export ABLY_CLI_NON_INTERACTIVE=true`,
          `ably chanels publish my-channel "Hello"  # Typo auto-corrects to "channels publish"`,
        ],
      },
    ]),
  ],
);

const ABLY_ENDPOINT = new EnvVarEntry(
  "ABLY_ENDPOINT",
  "Host Override",
  "Override Realtime/REST API endpoint",
  "Hostname or URL (passed as-is, no normalization)",
  "SDK default",
  "**`ABLY_ENDPOINT`** > account config endpoint > SDK default",
  ["channels", "rooms", "spaces", "connections", "bench", "logs"],
  "Override the Ably Realtime/REST API endpoint for all data plane commands.",
  new Example(
    "Override the Ably Realtime/REST API endpoint for all data plane commands.",
    [
      `export ABLY_ENDPOINT="custom-endpoint.example.com"`,
      `ably channels publish my-channel "Hello"`,
    ],
  ),
  [
    new DetailSection("Example", [
      {
        kind: "code",
        lines: [
          `export ABLY_ENDPOINT="custom-endpoint.example.com"`,
          `ably channels publish my-channel "Hello"`,
        ],
      },
    ]),
  ],
);

const AUTH_RESOLUTION_ORDER = new CrossCuttingSection(
  "Authentication Resolution Order",
  [
    {
      kind: "paragraph",
      text: "Data plane commands (channels, rooms, spaces, etc.):",
    },
    {
      kind: "numbered",
      items: [
        "`ABLY_TOKEN` environment variable (token auth)",
        "`ABLY_API_KEY` environment variable (API key auth)",
        "API key from logged-in account configuration (`~/.ably/config`)",
        "Interactive prompt to select app and key (requires `ABLY_ACCESS_TOKEN` or logged-in account)",
      ],
    },
    {
      kind: "paragraph",
      text: "Control API commands (accounts, apps, auth keys, etc.):",
    },
    {
      kind: "numbered",
      items: [
        "`ABLY_ACCESS_TOKEN` environment variable",
        "Access token from logged-in account configuration (`~/.ably/config`)",
      ],
    },
    { kind: "paragraph", text: "Login bypass summary:" },
    {
      kind: "table",
      headers: ["Variable", "What it bypasses", "Error on invalid credential"],
      rows: [
        [
          "`ABLY_API_KEY`",
          "Skips interactive app/key selection. App ID extracted from key.",
          '"Invalid API key. Ensure you have a valid key configured." (40100)',
        ],
        [
          "`ABLY_TOKEN`",
          "Skips interactive app/key selection. Token passed directly to SDK.",
          '"Invalid token. Please provide a valid Ably Token or JWT." (40100)',
        ],
        [
          "`ABLY_ACCESS_TOKEN`",
          "Skips account config lookup. Token used as bearer token for Control API.",
          "HTTP 401 from Control API",
        ],
      ],
    },
    { kind: "paragraph", text: "When any auth env var is set:" },
    {
      kind: "bullets",
      items: [
        "The account/app info banner is suppressed",
        "No `~/.ably/` config files are required",
      ],
    },
  ],
);

const ONE_SHOT_USAGE = new CrossCuttingSection(
  "Running Commands Without Login (One-Shot Usage)",
  [
    {
      kind: "paragraph",
      text: 'Environment variables enable "one-shot" command execution without any prior login, config files, or interactive prompts:',
    },
    {
      kind: "code",
      lines: [
        "# Data plane — publish with no setup",
        `ABLY_API_KEY="appId.keyId:keySecret" ably channels publish my-channel "Hello"`,
        "",
        "# Token auth — issue and use in one line",
        `ABLY_TOKEN="$(ABLY_API_KEY='appId.keyId:keySecret' ably auth issue-ably-token --token-only)" ably channels subscribe my-channel`,
        "",
        "# Control API — manage apps with no login",
        `ABLY_ACCESS_TOKEN="your-token" ably apps list --json`,
        "",
        "# Fully contextless — combine auth + app + non-interactive",
        `export ABLY_ACCESS_TOKEN="your-token"`,
        `export ABLY_APP_ID="your-app-id"`,
        `export ABLY_CLI_NON_INTERACTIVE=true`,
        `ably auth keys list --json`,
      ],
    },
  ],
);

const CICD_USAGE = new CrossCuttingSection("CI/CD Usage", [
  {
    kind: "paragraph",
    text: "Environment variables are the recommended authentication method for CI/CD pipelines:",
  },
  {
    kind: "code",
    lines: [
      "# GitHub Actions — store secrets in repository settings",
      `ABLY_API_KEY="\${{ secrets.ABLY_API_KEY }}" ably channels publish deploy-notifications "Deployment v1.2.3 complete"`,
      `ABLY_ACCESS_TOKEN="\${{ secrets.ABLY_ACCESS_TOKEN }}" ably apps list --json`,
      "",
      "# Combine with duration for scripted subscribe",
      `ABLY_API_KEY="\${{ secrets.ABLY_API_KEY }}" ABLY_CLI_DEFAULT_DURATION=10 ably channels subscribe my-channel --json`,
      "",
      "# Comprehensive workflow-level setup",
      `export ABLY_ACCESS_TOKEN="\${{ secrets.ABLY_ACCESS_TOKEN }}"`,
      `export ABLY_APP_ID="my-production-app"`,
      `export ABLY_CLI_NON_INTERACTIVE=true`,
      `ably auth keys list --json`,
    ],
  },
]);

const COMMANDS_BY_AUTH_TYPE = new CrossCuttingSection("Commands by Auth Type", [
  { kind: "paragraph", text: "Data Plane (`ABLY_API_KEY` / `ABLY_TOKEN`):" },
  {
    kind: "table",
    headers: ["Command group", "Subcommands"],
    rows: [
      [
        "`channels`",
        "publish, subscribe, list, history, occupancy, inspect, presence, annotations",
      ],
      ["`rooms`", "messages, presence, typing, reactions, occupancy"],
      ["`spaces`", "locks, cursors, members, locations, occupancy"],
      ["`connections`", "test"],
      ["`bench`", "publish, subscribe"],
      ["`logs`", "channel-lifecycle, connection-lifecycle, push"],
      ["`auth`", "issue-ably-token, issue-jwt-token, revoke-token"],
    ],
  },
  { kind: "paragraph", text: "Control API (`ABLY_ACCESS_TOKEN`):" },
  {
    kind: "table",
    headers: ["Command group", "Subcommands"],
    rows: [
      ["`accounts`", "login, switch, list, current, logout"],
      ["`apps`", "list, create, delete, update, current, switch"],
      ["`auth keys`", "list, create, update, revoke, switch, current, get"],
      ["`integrations`", "list, create, delete, update"],
      ["`queues`", "list, create, delete"],
      ["`push`", "device registrations, channel subscriptions, config"],
      ["`stats`", "app, account"],
    ],
  },
  { kind: "paragraph", text: "Hybrid:" },
  {
    kind: "paragraph",
    text: "Any data plane command when no API key is configured triggers the interactive app/key selection flow, which uses `ABLY_ACCESS_TOKEN` (or a logged-in account) to call the Control API.",
  },
]);

export const ENV_VARS_DATA: EnvVarsData = new EnvVarsData(
  {
    lede: "The Ably CLI supports environment variables for authentication. These are useful in scripts, CI/CD pipelines, and automated workflows where interactive login is not possible. When any of these variables are set, the CLI bypasses the `ably login` workflow entirely.",
    note: "The CLI does not automatically load `.env` files. Set environment variables in your shell, CI/CD configuration, or inline with your commands.",
    prerequisites: [
      {
        label: "Data plane commands",
        commands: [
          "channels",
          "rooms",
          "spaces",
          "connections",
          "bench",
          "logs",
          "auth",
        ],
        authVars: ["ABLY_API_KEY", "ABLY_TOKEN"],
      },
      {
        label: "Control API commands",
        commands: [
          "accounts",
          "apps",
          "auth keys",
          "integrations",
          "queues",
          "push",
          "stats",
        ],
        authVars: ["ABLY_ACCESS_TOKEN"],
      },
    ],
  },
  [
    ABLY_API_KEY,
    ABLY_TOKEN,
    ABLY_ACCESS_TOKEN,
    ABLY_ENDPOINT,
    ABLY_APP_ID,
    ABLY_CLI_CONFIG_DIR,
    ABLY_HISTORY_FILE,
    ABLY_CLI_DEFAULT_DURATION,
    ABLY_CLI_NON_INTERACTIVE,
  ],
  {
    authResolutionOrder: AUTH_RESOLUTION_ORDER,
    oneShotUsage: ONE_SHOT_USAGE,
    cicdUsage: CICD_USAGE,
    commandsByAuthType: COMMANDS_BY_AUTH_TYPE,
  },
  [
    new RelatedLink(
      "Authentication overview",
      "https://ably.com/docs/auth",
      "API key format, basic vs token auth, and security guidance",
    ),
    new RelatedLink(
      "API keys",
      "https://ably.com/docs/platform/account/app/api",
      "Create and manage API keys in the dashboard",
    ),
    new RelatedLink(
      "Token authentication",
      "https://ably.com/docs/auth/token",
      "Token auth flows, TTL limits, and token refresh",
    ),
    new RelatedLink(
      "JWTs",
      "https://ably.com/docs/auth/token/jwt",
      "JWT creation, claims, channel-scoped claims, and per-connection rate limits",
    ),
    new RelatedLink(
      "Capabilities",
      "https://ably.com/docs/auth/capabilities",
      "Capability operations and wildcard syntax for keys and tokens",
    ),
    new RelatedLink(
      "Access tokens",
      "https://ably.com/docs/platform/account/access-tokens",
      "Create, manage, rotate, and revoke access tokens for the Control API and CLI",
    ),
    new RelatedLink(
      "Control API",
      "https://ably.com/docs/platform/account/control-api",
      "Control API authentication and usage reference",
    ),
    new RelatedLink(
      "Ably CLI",
      "https://ably.com/docs/platform/tools/cli",
      "Official CLI documentation including authentication setup",
    ),
  ],
);
