# CLAUDE.md - Ably CLI Main Project

## ⚠️ STOP - MANDATORY WORKFLOW

**DO NOT SKIP - Run these IN ORDER for EVERY change:**

```bash
pnpm prepare        # 1. Build + update manifest/README
pnpm exec eslint .  # 2. Lint (MUST be 0 errors)
pnpm test:unit      # 3. Test (at minimum)
                    # 4. Update docs if needed
```

**If you skip these steps, the work is NOT complete.**

## 🗂️ Project Context

**First, verify where you are:**
```bash
pwd  # Should show: .../cli/main or similar
ls -la .cursor/rules/  # Should show .mdc files
```

**This project (`main`) is the Ably CLI npm package.** It may be:
1. Part of a larger workspace (with sibling `cli-terminal-server`)
2. Opened standalone

## 📚 Essential Reading

**MANDATORY - Read these .cursor/rules files before ANY work:**

1. `Workflow.mdc` - The mandatory development workflow
2. `Development.mdc` - Coding standards  
3. `AI-Assistance.mdc` - How to work with this codebase

**Finding the rules:**
```bash
# From this project root:
cat .cursor/rules/Workflow.mdc
cat .cursor/rules/Development.mdc
cat .cursor/rules/AI-Assistance.mdc
```

## ❌ Common Pitfalls - DO NOT DO THESE

1. **Skip tests** - Only skip with documented valid reason
2. **Use `_` prefix for unused variables** - Remove the code instead
3. **Leave debug code** - Remove ALL console.log, DEBUG_TEST, test-*.mjs
4. **Use `// eslint-disable`** - Fix the root cause
5. **Remove tests without asking** - Always get permission first
6. **NODE_ENV** - To check if the CLI is in test mode, use the `isTestMode()` helper function.
7. **`process.exit`** - When creating a command, use `this.exit()` for consistent test mode handling.

## ✅ Correct Practices

### When Tests Fail
```typescript
// ❌ WRONG
it.skip('test name', () => {

// ✅ CORRECT - Document why
it.skip('should handle Ctrl+C on empty prompt', function(done) {
  // SKIPPED: This test is flaky in non-TTY environments
  // The readline SIGINT handler doesn't work properly with piped stdio
```

### When Linting Fails
```typescript
// ❌ WRONG - Workaround
let _unusedVar = getValue();

// ✅ CORRECT - Remove unused code
// Delete the line entirely
```

### Debug Cleanup Checklist
```bash
# After debugging, ALWAYS check:
find . -name "test-*.mjs" -type f
grep -r "DEBUG_TEST" src/ test/
grep -r "console.log" src/  # Except legitimate output
```

## 🚀 Quick Reference

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

## 📁 Project Structure

```
.
├── src/
│   ├── commands/      # CLI commands (oclif)
│   ├── services/      # Business logic
│   ├── utils/         # Utilities
│   └── base-command.ts
├── test/
│   ├── unit/          # Fast, mocked
│   ├── integration/   # Real execution
│   └── e2e/           # Full scenarios
├── .cursor/
│   └── rules/         # MUST READ
└── package.json       # Scripts defined here
```

## 🏗️ Flag Architecture

Flags are NOT global. Each command explicitly declares only the flags it needs via composable flag sets defined in `src/flags.ts`:

- **`coreGlobalFlags`** — `--verbose`, `--json`, `--pretty-json` (on every command via `AblyBaseCommand.globalFlags`)
- **`productApiFlags`** — core + hidden product API flags (`port`, `tlsPort`, `tls`). Use for commands that talk to the Ably product API.
- **`controlApiFlags`** — core + hidden control API flags (`control-host`, `dashboard-host`). Use for commands that talk to the Control API.
- **`clientIdFlag`** — `--client-id`. Add only to commands that create a realtime connection where client identity matters (presence, spaces members, cursors, locks, publish, etc.). Do NOT add globally.
- **`endpointFlag`** — `--endpoint`. Hidden, only on `accounts login` and `accounts switch`.

**When creating a new command:**
```typescript
// Product API command (channels, spaces, rooms, etc.)
import { productApiFlags, clientIdFlag } from "../../flags.js";
static override flags = {
  ...productApiFlags,
  ...clientIdFlag,  // Only if command needs client identity
  // command-specific flags...
};

// Control API command (apps, keys, queues, etc.)
import { controlApiFlags } from "../../flags.js";
static override flags = {
  ...controlApiFlags,
  // command-specific flags...
};
```

**Auth** is managed via `ably login` (stored config). Environment variables override stored config for CI, scripting, or testing:
- `ABLY_API_KEY`, `ABLY_TOKEN`, `ABLY_ACCESS_TOKEN`

Do NOT add `--api-key`, `--token`, or `--access-token` flags to commands.

## 🧪 Writing Tests

**Auth in tests — use environment variables, NEVER CLI flags:**
```typescript
// ❌ WRONG — --api-key, --token, --access-token are NOT CLI flags
runCommand(["channels", "publish", "my-channel", "hello", "--api-key", key]);

// ✅ CORRECT — pass auth via env vars
runCommand(["channels", "publish", "my-channel", "hello"], {
  env: { ABLY_API_KEY: key },
});

// ✅ CORRECT — spawn with env vars
spawn("node", [cliPath, "channels", "subscribe", "my-channel"], {
  env: { ...process.env, ABLY_API_KEY: key },
});

// ✅ Control API commands use ABLY_ACCESS_TOKEN
runCommand(["stats", "account"], {
  env: { ABLY_ACCESS_TOKEN: token },
});
```

**Test structure:**
- `test/unit/` — Fast, mocked tests. Use `ABLY_API_KEY` env var in test setup.
- `test/e2e/` — Full scenarios against real Ably. Use env vars for auth.
- Helpers in `test/helpers/` — `runCommand()`, `runLongRunningBackgroundProcess()`, `e2e-test-helper.ts`.

**Running tests:**
```bash
pnpm test:unit                    # All unit tests
pnpm test:e2e                     # All E2E tests
pnpm test test/unit/commands/foo.test.ts  # Specific test
```

## 🔍 Related Projects

If this is part of a workspace, there may be:
- `../cli-terminal-server/` - WebSocket terminal server
- `../` - Workspace root with its own `.claude/CLAUDE.md`

But focus on THIS project unless specifically asked about others.

## ✓ Before Marking Complete

- [ ] `pnpm prepare` succeeds
- [ ] `pnpm exec eslint .` shows 0 errors  
- [ ] `pnpm test:unit` passes
- [ ] No debug artifacts remain
- [ ] Docs updated if needed
- [ ] Followed oclif patterns

**Quality matters. This is read by developers.**