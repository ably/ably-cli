# Project Structure

This document outlines the directory structure of the Ably CLI project.

> **Note:** The terminal server has been moved to a separate repository ([cli-terminal-server](https://github.com/ably/cli-terminal-server)). The `server/` directory contains only a `REMOVED.md` tombstone.

```text
/
├── assets/                     # Static assets (e.g. CLI screenshot)
├── bin/                        # Executable scripts
│   ├── ably-interactive        # Bash wrapper for interactive mode (restarts on Ctrl+C)
│   ├── ably-interactive.ps1    # PowerShell equivalent for Windows
│   ├── dev.cmd                 # Development run script (Windows)
│   ├── development.js          # Development run script (Unix)
│   ├── run.cmd                 # Production run script (Windows)
│   └── run.js                  # Production run script (Unix)
├── docs/                       # Project documentation
├── examples/
│   └── web-cli/                # Example web-based CLI app (uses @ably/react-web-cli)
├── packages/
│   └── react-web-cli/          # @ably/react-web-cli React component (published to npm)
├── scripts/
│   ├── postinstall-welcome.ts  # Post-installation welcome message
│   └── pre-push-validation.sh  # Pre-push validation checks
├── server/
│   └── REMOVED.md              # Tombstone — server moved to cli-terminal-server repo
├── src/                        # CLI source code
│   ├── base-command.ts         # Base class for all CLI commands
│   ├── base-topic-command.ts   # Base class for topic (group) commands
│   ├── chat-base-command.ts    # Base class for Ably Chat commands
│   ├── control-base-command.ts # Base class for Control API commands
│   ├── interactive-base-command.ts # Base class for interactive/streaming commands
│   ├── spaces-base-command.ts  # Base class for Ably Spaces commands
│   ├── flags.ts                # Composable flag sets (see AGENTS.md for details)
│   ├── help.ts                 # Custom help class
│   ├── index.ts                # Main entry point
│   ├── commands/               # CLI commands (oclif)
│   │   ├── accounts/           # Account management (login, logout, list, switch, current)
│   │   ├── apps/               # App management (create, list, delete, switch, current, etc.)
│   │   ├── auth/               # Authentication (keys, tokens)
│   │   ├── bench/              # Benchmarking (publisher, subscriber)
│   │   ├── channel-rule/       # Channel rules / namespaces
│   │   ├── channels/           # Pub/Sub channels (publish, subscribe, presence, history, etc.)
│   │   ├── config/             # CLI config management (show, path)
│   │   ├── connections/        # Client connections (test)
│   │   ├── integrations/       # Integration rules
│   │   ├── logs/               # Log streams (subscribe, history, push subscribe)
│   │   ├── queues/             # Queue management
│   │   ├── rooms/              # Ably Chat rooms (send, subscribe, presence, reactions, typing, etc.)
│   │   ├── spaces/             # Ably Spaces (members, cursors, locations, locks)
│   │   ├── stats/              # Usage statistics
│   │   ├── support/            # Support contact info
│   │   ├── test/               # Diagnostic test commands
│   │   ├── help.ts             # Help command
│   │   ├── interactive.ts      # Interactive REPL mode
│   │   ├── login.ts            # Alias for `accounts login`
│   │   ├── status.ts           # Ably service status
│   │   └── version.ts          # CLI version info
│   ├── hooks/                  # oclif lifecycle hooks
│   │   ├── command_not_found/  # Fuzzy-match suggestions for unknown commands
│   │   └── init/               # CLI initialization
│   ├── services/               # Business logic
│   │   ├── config-manager.ts   # CLI configuration (accounts, apps, API keys)
│   │   ├── control-api.ts      # Ably Control API HTTP client
│   │   ├── history-manager.ts  # Interactive mode command history persistence
│   │   ├── interactive-helper.ts # Interactive prompts (confirm, select account/app)
│   │   └── stats-display.ts    # Stats formatting and display
│   ├── types/
│   │   └── cli.ts              # General CLI type definitions
│   └── utils/
│       ├── interrupt-feedback.ts   # Ctrl+C feedback messages
│       ├── json-formatter.ts       # JSON output formatting
│       ├── logo.ts                 # ASCII art logo with gradient
│       ├── long-running.ts         # Long-running command helpers (duration, cleanup)
│       ├── open-url.ts             # Cross-platform URL opener
│       ├── output.ts               # Output helpers (progress, success, resource, etc.)
│       ├── prompt-confirmation.ts  # Y/N confirmation prompts
│       ├── readline-helper.ts      # Readline utilities for interactive mode
│       ├── sigint-exit.ts          # SIGINT/Ctrl+C handling (exit code 130)
│       ├── string-distance.ts      # Levenshtein distance for fuzzy matching
│       ├── terminal-diagnostics.ts # Terminal capability detection
│       ├── test-mode.ts            # isTestMode() helper
│       ├── version.ts              # Version string utilities
│       └── web-mode.ts             # Web CLI mode detection
├── test/                       # Automated tests
│   ├── setup.ts                # Global test setup (runs in Vitest context)
│   ├── root-hooks.ts           # Mocha-compatible root hooks for E2E
│   ├── tsconfig.json           # Test-specific TypeScript config
│   ├── helpers/                # Shared test utilities
│   │   ├── cli-runner.ts           # CliRunner class for E2E process management
│   │   ├── cli-runner-store.ts     # Per-test CLI runner tracking
│   │   ├── command-helpers.ts      # High-level E2E helpers (startSubscribeCommand, etc.)
│   │   ├── e2e-test-helper.ts      # E2E test setup and teardown
│   │   ├── mock-ably-chat.ts       # Mock Ably Chat SDK
│   │   ├── mock-ably-realtime.ts   # Mock Ably Realtime SDK
│   │   ├── mock-ably-rest.ts       # Mock Ably REST SDK
│   │   ├── mock-ably-spaces.ts     # Mock Ably Spaces SDK
│   │   ├── mock-config-manager.ts  # MockConfigManager (provides test auth)
│   │   ├── mock-control-api-keys.ts # Mock Control API key responses
│   │   └── ably-event-emitter.ts   # Event emitter helper for mock SDKs
│   ├── unit/                   # Fast, mocked tests
│   │   ├── setup.ts            # Unit test setup
│   │   ├── base/               # Base command class tests
│   │   ├── base-command/       # AblyBaseCommand tests
│   │   ├── commands/           # Command-level unit tests (mirrors src/commands/)
│   │   ├── core/               # Core CLI functionality tests
│   │   ├── help/               # Help system tests
│   │   ├── hooks/              # Hook tests
│   │   ├── services/           # Service tests
│   │   └── utils/              # Utility tests
│   ├── integration/            # Multi-component tests (mocked external services)
│   │   ├── commands/           # Command flow integration tests
│   │   └── interactive-mode.test.ts # Interactive REPL integration tests
│   ├── e2e/                    # End-to-end tests against real Ably
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
├── .claude/                    # Claude Code AI configuration
├── .github/                    # GitHub Actions workflows and config
├── .env.example                # Example environment variables
├── .gitignore
├── .npmrc
├── .prettierrc.json            # Prettier config
├── eslint.config.js            # ESLint v9 flat config
├── tsconfig.json               # Main TypeScript config
├── tsconfig.eslint.json        # TypeScript config for ESLint
├── tsconfig.test.json          # TypeScript config for tests
├── vitest.config.ts            # Vitest config
├── pnpm-workspace.yaml         # pnpm workspace config
├── pnpm-lock.yaml
├── package.json
├── AGENTS.md                   # AI agent instructions
├── CONTRIBUTING.md             # Contribution guidelines
├── CHANGELOG.md
├── LICENSE
└── README.md
```
