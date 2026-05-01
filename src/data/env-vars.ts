// Per-variable CLI reference rendered by `ably env` and `ably env <NAME>`.
// Intentionally trimmed to "what it is and what it overrides" — the long-form
// prose with side-effect notes, doc cross-links, and obtaining flows lives in
// docs/Environment-Variables/General-Usage.md and is the source of truth.
//
// Editing convention:
//   - Plain strings only. No chalk, no template helpers.
//   - Inline `code-spans` use backticks (rendered cyan).
//   - Inline **bold-spans** use double asterisks.
//   - One inline URL max per variable, only the canonical "where to get one"
//     link. All other doc references go in `relatedLinks` (JSON-only).
//   - Variable order matters: rendering follows array order.

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
  constructor(public readonly lines: readonly string[]) {}
}

export class EnvVarEntry {
  constructor(
    public readonly name: string,
    public readonly category: EnvVarCategory,
    public readonly summary: string,
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
  "Authenticate data plane commands with an Ably API key. Manage keys in the Ably dashboard: https://ably.com/accounts/any/apps/any/app_keys",
  new Example([
    `export ABLY_API_KEY="your-app-id.key-id:key-secret"`,
    `ably channels publish my-channel "Hello"`,
  ]),
  [],
);

const ABLY_TOKEN = new EnvVarEntry(
  "ABLY_TOKEN",
  "Authentication",
  "Token/JWT for data plane commands",
  "Ably token string or JWT string",
  "None",
  "**`ABLY_TOKEN`** > `ABLY_API_KEY` > config file > interactive prompt",
  ["channels", "rooms", "spaces", "connections", "bench", "logs"],
  "Authenticate data plane commands with an Ably token or JWT (**highest priority** of all auth methods). Issue with `ably auth issue-ably-token` or `ably auth issue-jwt-token`.",
  new Example([
    `export ABLY_TOKEN="$(ably auth issue-ably-token --token-only)"`,
    `ably channels subscribe my-channel`,
  ]),
  [
    new DetailSection("", [
      {
        kind: "important",
        text: "`ABLY_TOKEN` overrides any API key, so `auth issue-ably-token` (which requires a key) fails when set. Run `unset ABLY_TOKEN` before issuing tokens.",
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
  "Authenticate Control API commands with an access token. Create one in the Ably dashboard: https://ably.com/users/access_tokens",
  new Example([
    `export ABLY_ACCESS_TOKEN="your-access-token"`,
    `ably apps list --json`,
  ]),
  [],
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
  new Example([`export ABLY_APP_ID="your-app-id"`, `ably auth keys list`]),
  [],
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
  new Example([
    `export ABLY_CLI_CONFIG_DIR="/path/to/custom/config"`,
    `ably accounts login`,
  ]),
  [],
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
  new Example([
    `export ABLY_HISTORY_FILE="/path/to/custom/history"`,
    `ably-interactive`,
  ]),
  [
    new DetailSection("", [
      {
        kind: "note",
        text: "Auto-set by the `ably-interactive` shell wrapper; only set manually for a custom location.",
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
  new Example([
    `ABLY_CLI_DEFAULT_DURATION=30 ably channels subscribe my-channel`,
  ]),
  [],
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
  new Example([
    `export ABLY_CLI_NON_INTERACTIVE=true`,
    `ably chanels publish my-channel "Hello"`,
  ]),
  [],
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
  new Example([
    `export ABLY_ENDPOINT="custom-endpoint.example.com"`,
    `ably channels publish my-channel "Hello"`,
  ]),
  [],
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
        "# Data plane: publish with no setup",
        `ABLY_API_KEY="appId.keyId:keySecret" ably channels publish my-channel "Hello"`,
        "",
        "# Token auth: issue and use in one line",
        `ABLY_TOKEN="$(ABLY_API_KEY='appId.keyId:keySecret' ably auth issue-ably-token --token-only)" ably channels subscribe my-channel`,
        "",
        "# Control API: manage apps with no login",
        `ABLY_ACCESS_TOKEN="your-access-token" ably apps list --json`,
        "",
        "# Fully contextless: combine auth + app + non-interactive",
        `export ABLY_ACCESS_TOKEN="your-access-token"`,
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
      "# GitHub Actions: store secrets in repository settings",
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
    lede: "The Ably CLI supports environment variables for authentication and configuration. These bypass the `ably login` workflow and are useful in scripts, CI/CD pipelines, and automated workflows.",
    note: "The CLI does not automatically load `.env` files. Set them in your shell or CI.",
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
