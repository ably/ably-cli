---
name: ably-review
description: "Review the current branch's changes against the standards and conventions defined in the ably-new-command skill. Use this skill whenever asked to review current changes, check a branch, review a PR, or validate work-in-progress — even casually (e.g., 'review my changes', 'does this branch look good', 'check my work', 'review before PR'). Do NOT use for full codebase audits (use ably-codebase-review instead), creating new commands, or fixing individual bugs."
---

# Ably Branch Review

This skill reviews **only the changes on the current branch** (compared to main) against the conventions defined in the `ably-new-command` skill. It uses a combination of **LSP** for structural analysis (type hierarchies, call chains) and **grep/read** for text-pattern checks, choosing the right tool for each check.

Unlike `ably-codebase-review` which sweeps the entire codebase, this skill is scoped to what has changed on the current branch, making it fast and focused for pre-PR review.

## Tool selection guide

**Use LSP when you need type-system awareness:**
- `goToDefinition` — resolve what base class a command actually extends
- `findReferences` — trace all callers of a method through inheritance
- `hover` — reveal resolved types, inherited members, full type hierarchy
- `documentSymbol` — list all methods/properties in a class structurally

**Use grep/read when a text match is sufficient:**
- `this.error()` calls in command files
- Component string casing in `this.fail()` and `logCliEvent()` calls
- `new Error(...)` wrapping in `this.fail()` calls (unnecessary — accepts strings)
- `shouldOutputJson` guards around `this.log()`
- `formatSuccess()` calls ending with `.`
- `formatProgress()` calls with manual `...`
- `chalk.cyan()` where `formatResource()` should be used
- Quoted resource names instead of `formatResource(name)`
- `--json` / `--pretty-json` in `static examples` arrays
- Flag spreads like `...productApiFlags`, `...durationFlag`, `...clientIdFlag`
- `waitUntilInterruptedOrTimeout` usage
- Missing test files (glob for them)
- `--duration` flag in subscribe test files
- Mock helper imports (`getMockAblyRealtime`, `getMockAblyRest`, `getMockConfigManager`)

## Step 0: Verify LSP prerequisites

Before doing any analysis, check that the LSP tooling is available:

1. **Check for the LSP tool** — verify the `LSP` tool is available in your tool list. If it is not, tell the user:
   > The LSP plugin is not installed. Install it by running:
   > ```
   > claude plugin add anthropic/claude-code-lsp
   > ```
   > Then restart Claude Code and re-run this skill.
   Stop here — do not proceed without the LSP tool.

2. **Check for `typescript-language-server`** — run `which typescript-language-server` or `npx --yes typescript-language-server --version`. If the binary is not found, install it globally for the user:
   ```
   npm install -g typescript-language-server typescript
   ```
   Confirm installation succeeded before proceeding.

## Step 1: Identify changed files

Run `git diff main...HEAD --name-only` to get the list of files changed on this branch. Filter to only files relevant for review:
- `src/commands/**/*.ts` — command files
- `src/**/*-base-command.ts` — base classes
- `src/flags.ts` — flag definitions
- `src/utils/output.ts` — output helpers
- `test/unit/commands/**/*.ts` — test files
- `test/helpers/**/*.ts` — test helpers

Also run `git log main..HEAD --oneline` to understand the scope of changes.

If there are no changes compared to main (i.e., the branch IS main), tell the user and stop.

## Step 2: Read the reference skill

Read these files to understand the canonical patterns:
- `.claude/skills/ably-new-command/SKILL.md` — the checklist and conventions
- `.claude/skills/ably-new-command/references/patterns.md` — implementation templates
- `.claude/skills/ably-new-command/references/testing.md` — test scaffolds

## Step 3: Review changed files

For each changed command file, run the relevant checks. Spawn agents for parallel review when multiple command files are changed. For 1–2 files, review sequentially.

### For changed command files (`src/commands/**/*.ts`)

**Base class check (LSP — needs type resolution):**
1. Use `LSP goToDefinition` on the base class to confirm it resolves correctly
2. Use `LSP hover` to verify the full type hierarchy
3. Verify the command extends the right base class per the skill rules (rooms/* → `ChatBaseCommand`, spaces/* → `SpacesBaseCommand`, etc.)
4. For index files (`index.ts`), verify they extend `BaseTopicCommand` with correct `topicName` and `commandGroup` properties

**Error handling check (grep, with LSP for ambiguous cases):**
1. **Grep** for `this\.error\(` in the file — should use `this.fail()` instead
2. If found, use **LSP** `hover` on the call to confirm it's the oclif `this.error()` and not something else
3. **Grep** for `this\.fail\(` and check component strings are camelCase — single-word lowercase (`"room"`, `"auth"`), multi-word camelCase (`"channelPublish"`, `"roomPresenceSubscribe"`). Flag PascalCase like `"ChannelPublish"` or kebab-case like `"web-cli"`.
4. **Grep** for `this\.fail\(\s*new Error\(` — `this.fail()` accepts plain strings, so `new Error(...)` wrapping is unnecessary. Flag as a simplification opportunity.

**Output formatting check (grep/read — text patterns):**
1. **Grep** for `chalk\.cyan\(` — should use `formatResource()` instead
2. **Grep** for `chalk\.yellow\(` — should use `formatWarning()` instead
3. **Grep** for `formatProgress(` and check for manual `...` appended
4. **Grep** for `formatSuccess(` and check lines end with `.`
5. **Read** the file and look for unguarded `this.log()` calls (not inside `if (!this.shouldOutputJson(flags))`)
6. Look for quoted resource names instead of `formatResource(name)`

**Flag architecture check (grep, with LSP for ambiguous cases):**
1. **Grep** for flag spreads (`productApiFlags`, `clientIdFlag`, `durationFlag`, `rewindFlag`, `timeRangeFlags`, `ControlBaseCommand.globalFlags`)
2. Verify correct flag sets per the skill rules
3. Check subscribe commands have `durationFlag`, `rewindFlag`, `clientIdFlag` as appropriate
4. For ambiguous cases, use **LSP** `goToDefinition` to confirm flag imports resolve to `src/flags.ts`

**JSON output check (grep/read):**
1. **Grep** for `logJsonResult` or `logJsonEvent` — every leaf command should use one
2. **Grep** for `formatJsonRecord` — direct usage should be flagged as needing migration
3. **Grep** for `shouldOutputJson` — verify human output is guarded
4. **Read** the file to verify streaming commands use `logJsonEvent` and one-shot commands use `logJsonResult`

**Control API helper check (grep — for Control API commands only):**
1. **Grep** for `resolveAppId` — should use `requireAppId` instead (encapsulates null check and `fail()`)
2. **Grep** for `createControlApi` with manual try-catch — consider `runControlCommand` for single API calls

**Lifecycle check (grep/read):**
1. **Grep** for `waitUntilInterruptedOrTimeout` — should use `this.waitAndTrackCleanup()` instead
2. **Read** `static examples` and check for `--json` or `--pretty-json` variant
3. **Read** the command description — verify imperative mood, sentence case, no trailing period

### For changed test files (`test/unit/commands/**/*.ts`)

1. **Grep** for `describe(` to check for the 5 required describe blocks with EXACT standard names:
   - `describe("help"` — required in every test file
   - `describe("argument validation"` — required (test required args OR unknown flag rejection)
   - `describe("functionality"` — required (core happy-path tests)
   - `describe("flags"` — required (verify flags exist and work)
   - `describe("error handling"` — required (API errors, network failures)
   Flag any non-standard variants: `"command arguments and flags"`, `"command flags"`, `"flag options"`, `"parameter validation"`. These must use the exact standard names above.
   Exception: `interactive.test.ts`, `interactive-sigint.test.ts`, and `bench/*.test.ts` are exempt (REPL/benchmark tests, not command tests).
2. **Grep** for `getMockAblyRealtime`, `getMockAblyRest`, `getMockConfigManager` to verify correct mock usage
3. **Grep** for `--duration` in unit test `runCommand()` args — should NOT be present (env var handles it). Exceptions: `test:wait` tests, `interactive-sigint` tests, help output checks.
4. **Grep** for `--api-key`, `--token`, `--access-token` — unit tests should not use CLI auth flags
5. **Check** for use of shared test helpers where applicable:
   - Control API tests should consider using `nockControl()`, `getControlApiContext()`, `controlApiCleanup()` from `test/helpers/control-api-test-helpers.ts` instead of manual nock setup
   - Control API tests should consider using mock factories (`mockApp()`, `mockKey()`, `mockRule()`, `mockQueue()`, `mockNamespace()`, `mockStats()`) from `test/fixtures/control-api.ts` instead of inline response objects
   - Tests with boilerplate help/arg-validation/flags blocks should consider using `standardHelpTests()`, `standardArgValidationTests()`, `standardFlagTests()` from `test/helpers/standard-tests.ts`
   - Control API error handling blocks should use `standardControlApiErrorTests()` from `test/helpers/standard-tests.ts` for 401/500/network error tests
   - JSON envelope tests should use `captureJsonLogs()` from `test/helpers/ndjson.ts` instead of manual console.log spying

### For new command files (added, not modified)

Apply the full checklist from the `ably-new-command` skill. These deserve the most scrutiny since they're entirely new code. Use both LSP (base class, type hierarchy) and grep/read (all text-pattern checks).

### For changed base classes or utilities

1. **Read** the changes and verify they don't break patterns relied on by commands
2. **Grep** for new helper functions and check naming conventions (`format*` prefix for output helpers)
3. **Grep** for `this\.error\(` — should only be used inside `fail()`, not directly

## Step 4: Check for missing test coverage

**Glob** for each new or modified command file and check if a corresponding test file exists at `test/unit/commands/`. If a command was added but no test was added, flag it.

## Step 5: Output findings

Present findings directly to the user, organized by file. Lead with a summary.

### Summary

| File | Status | Issues |
|------|--------|--------|
| `src/commands/foo/bar.ts` | N issues | Brief list |
| `test/unit/commands/foo/bar.test.ts` | OK | — |

### Findings by file

For each file with issues:

#### `src/commands/foo/bar.ts`

1. **[Category]** — description of the issue
   - **Rule:** [The skill rule being checked]
   - **Evidence:** [Line number, tool used (LSP/grep/read), what was found]
   - **Suggested Fix:** [What to change]
   - **Verdict:** TRUE DEVIATION | ACCEPTABLE EXCEPTION

### Overall assessment

A brief summary: does this branch follow the conventions well? Are the issues minor or major? Is it ready for PR?
