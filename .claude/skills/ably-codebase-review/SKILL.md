---
name: ably-codebase-review
description: "Review the entire Ably CLI codebase against the standards and conventions defined in the ably-new-command skill. Use this skill whenever asked to audit, review, check alignment, verify compliance, or find deviations from the command creation patterns — even casually (e.g., 'review the codebase', 'check if commands follow patterns', 'audit the codebase', 'find deviations', 'how well do we follow conventions'). Do NOT use for creating new commands or fixing individual bugs."
---

# Ably Codebase Review

This skill reviews the entire Ably CLI codebase against the conventions defined in the `ably-new-command` skill. It uses a combination of **LSP** for structural analysis (type hierarchies, call chains, symbol definitions) and **grep/read** for text-pattern checks, choosing the right tool for each check.

## Tool selection guide

**Use LSP when you need type-system awareness:**
- `goToDefinition` — resolve what base class a command actually extends (not just the import text)
- `findReferences` — trace all callers of `fail()`, `logJsonResult`, `logJsonEvent` through inheritance
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

## Step 1: Read the reference skill

Read these files to understand the canonical patterns:
- `.claude/skills/ably-new-command/SKILL.md` — the checklist and conventions
- `.claude/skills/ably-new-command/references/patterns.md` — implementation templates
- `.claude/skills/ably-new-command/references/testing.md` — test scaffolds

## Step 2: Spawn sweep agents

Launch these agents **in parallel**. Each agent gets a focused mandate and uses the appropriate tool (LSP or grep/read) per check.

### Agent 1: Base Class & Inheritance Sweep

**Goal:** Verify every command extends the correct base class per the skill's rules.

**Method (LSP — needs type resolution):**
1. Use `LSP documentSymbol` on each command file in `src/commands/` to find the class export
2. Use `LSP goToDefinition` on the base class reference (e.g., `AblyBaseCommand`, `ControlBaseCommand`, `ChatBaseCommand`, `SpacesBaseCommand`, `StatsBaseCommand`) to confirm it resolves to the correct file
3. Cross-reference: rooms/* commands should extend `ChatBaseCommand`, spaces/* should extend `SpacesBaseCommand`, stats/* should extend `StatsBaseCommand`, control API commands should extend `ControlBaseCommand`
4. Use `LSP hover` on the class declaration to see the full type hierarchy

**What to flag:** Commands extending the wrong base class, or commands that should use a specialized base class but use `AblyBaseCommand` directly (exception: REST-only commands in rooms/spaces that don't need realtime lifecycle). Also verify that topic index files (`src/commands/*/index.ts`, `src/commands/*/*/index.ts`) extend `BaseTopicCommand` with correct `topicName` and `commandGroup` properties.

### Agent 2: Error Handling Sweep

**Goal:** Verify all commands use `fail()` exclusively for errors, not `this.error()` or `chalk.red()`.

**Method (mixed):**
1. **LSP** `findReferences` on `fail` (from base-command.ts) to get every call site — confirms all commands funnel through `fail()`
2. **Grep** for `this\.error\(` in `src/commands/` to find direct error calls — simple text match is sufficient here
3. For any ambiguous matches, use **LSP** `hover` to confirm they're the oclif `this.error()` and not something else
4. **Grep** for `this\.fail\(` and check component strings are camelCase — single-word lowercase (`"room"`, `"auth"`), multi-word camelCase (`"channelPublish"`, `"roomPresenceSubscribe"`). Flag PascalCase like `"ChannelPublish"` or kebab-case like `"web-cli"`.
5. **Grep** for `this\.fail\(\s*new Error\(` — `this.fail()` accepts plain strings, so `new Error(...)` wrapping is unnecessary. Flag as a simplification opportunity.
6. **Check** that catch blocks calling `this.fail()` do NOT include manual oclif error re-throw guards (`if (error instanceof Error && "oclif" in error) throw error`). The base class `fail()` method handles this automatically — manual guards are unnecessary boilerplate.

**Reasoning guidance:**
- Base class files (`*-base-command.ts`) using `this.error()` are deviations — they should use `this.fail()` instead
- `src/commands/interactive.ts` is exempt (REPL mode)
- `src/commands/help.ts` extending `Command` directly is exempt (no `fail` available)
- `chalk.red("✗")` used as visual indicators (not error handling) is exempt
- Component strings must be camelCase for consistency in verbose logs and JSON envelopes

**Error hints (`src/utils/errors.ts`):**
7. **Grep** for double-quoted CLI commands inside hint strings (e.g., `"ably login"`) — must use single quotes to avoid `\"` in JSON output
8. **Check** that long hints use `\n` for manual line breaks — oclif auto-wraps at awkward positions
9. **Verify** that `this.fail()` in base-command.ts strips `\n` from hints in JSON output (`.replaceAll("\n", " ")`)

### Agent 3: Output Formatting Sweep

**Goal:** Verify all human output uses the correct format helpers and is JSON-guarded.

**Method (grep/read — text patterns):**
1. **Grep** for `chalk\.cyan\(` in command files — should use `formatResource()` instead
2. **Grep** for `formatProgress(` and check matches for manual `...` appended
3. **Grep** for `formatSuccess(` and read the lines to check they end with `.`
4. **Grep** for `shouldOutputJson` to find all JSON-aware commands
5. **Read** command files and look for unguarded `this.log()` calls (not inside `if (!this.shouldOutputJson(flags))`)
6. **Grep** for quoted resource names patterns like `"${` or `'${` near `channel`, `name`, `app` variables — should use `formatResource()`

**Method (grep — structured output format):**
7. **Grep** for box-drawing characters (`┌`, `┬`, `├`, `└`, `│`) in command files — non-JSON output must use multi-line labeled blocks, not ASCII tables or grids
8. **Grep** for subscribe commands that call `getAll()` or equivalent before subscribing — subscribe commands must NOT fetch initial state (they should only listen for new events)
9. For data-outputting commands, **read** both the JSON and non-JSON output paths and compare fields — non-JSON should expose the same fields as JSON mode (omitting only null/empty values)
10. **Grep** for local `interface` definitions in `src/commands/` that duplicate SDK types (e.g., `interface CursorPosition`, `interface CursorData`, `interface PresenceMessage`) — these should import from `ably`, `@ably/spaces`, or `@ably/chat` instead. Display/output interfaces in `src/utils/` are intentional and fine.

**Method (LSP — for completeness mapping):**
11. Use `LSP findReferences` on `shouldOutputJson` to get the definitive list of all commands that check for JSON mode — cross-reference against the full command list to find commands missing JSON guards

**Reasoning guidance:**
- List commands don't use `formatSuccess()` (no action to confirm) — this is correct, not a deviation
- `chalk.red("✗")` / `chalk.green("✓")` as visual indicators in test/bench output is acceptable
- `chalk.yellow("Warning: ...")` should use `formatWarning()` instead — `formatWarning` adds the `⚠` symbol automatically and "Warning:" prefix is unnecessary
- ASCII tables/grids in non-JSON output are deviations — use multi-line labeled blocks with `formatLabel()` instead
- Subscribe commands fetching initial state (via `getAll()`, `getSelf()`, etc.) before subscribing are deviations — subscribe should only listen for new events
- Non-JSON output that hides fields available in JSON mode is a deviation — both modes should expose the same data
- Local `interface` definitions in command files that duplicate SDK types are deviations — import from the SDK package instead. Display/output interfaces in `src/utils/` (e.g., `MemberOutput`, `MessageDisplayFields`) are intentional transformations, not duplicates.

### Agent 4: Flag Architecture Sweep

**Goal:** Verify every command uses the correct flag sets per the skill rules.

**Method (grep — text patterns):**
1. **Grep** for `productApiFlags`, `clientIdFlag`, `durationFlag`, `rewindFlag`, `timeRangeFlags`, `ControlBaseCommand.globalFlags` in command files to map which commands use which flag sets
2. Cross-reference against the rules:
   - Product API commands must use `productApiFlags`
   - Subscribe/stream commands must have `durationFlag`
   - Subscribe commands with replay must have `rewindFlag`
   - History/stats commands must have `timeRangeFlags`
   - Commands creating realtime connections or performing mutations (publish, update, delete, append) must have `clientIdFlag`
   - Control API commands must use `ControlBaseCommand.globalFlags`

**Method (LSP — for ambiguous cases):**
3. Use `LSP goToDefinition` on flag spread references to confirm they resolve to `src/flags.ts` (not a local redefinition)

**Reasoning guidance:**
- A command that creates a realtime client or performs a mutation (publish, update, delete, append) but doesn't have `clientIdFlag` is a deviation
- A non-subscribe command having `durationFlag` is suspicious but might be valid (e.g., presence enter)
- Control API commands should NOT have `productApiFlags`

### Agent 5: JSON Output & Envelope Sweep

**Goal:** Verify all commands produce correct JSON output when `--json` is used.

**Method (mixed):**
1. **LSP** `findReferences` on `logJsonResult` and `logJsonEvent` to get the definitive list of all call sites — every leaf command should use one of these
2. **Grep** for `formatJsonRecord` in command files (not base-command.ts) — direct usage should be flagged as needing migration to `logJsonResult`/`logJsonEvent`
3. **Grep** for `shouldOutputJson` in command files to find all JSON-aware commands
4. Cross-reference: every leaf command should appear in both the `logJsonResult`/`logJsonEvent` list and the `shouldOutputJson` list
5. **Read** streaming commands to verify they use `logJsonEvent`, one-shot commands use `logJsonResult`
6. **Read** each `logJsonResult`/`logJsonEvent` call and verify data is nested under a domain key — singular for events/single items (e.g., `{message: ...}`, `{cursor: ...}`), plural for collections (e.g., `{cursors: [...]}`, `{rules: [...]}`). Top-level envelope fields are `type`, `command`, `success` only. Metadata like `total`, `timestamp`, `appId` may sit alongside the domain key.
7. **Check** hold commands (set, enter, acquire) emit `logJsonStatus("holding", ...)` after `logJsonResult` — this signals to JSON consumers that the command is alive and waiting for Ctrl+C / `--duration`

**Reasoning guidance:**
- Commands that ONLY have human output (no JSON path) are deviations
- Direct `formatJsonRecord` usage in command files should use `logJsonResult`/`logJsonEvent` instead
- Topic index commands (showing help) don't need JSON output
- Data spread at the top level without a domain key is a deviation — nest under a singular or plural domain noun
- Metadata fields (`total`, `timestamp`, `hasMore`, `appId`) alongside the domain key are acceptable — they describe the result, not the domain objects
- Hold commands missing `logJsonStatus` after `logJsonResult` are deviations — JSON consumers need the hold signal

### Agent 6: Test Pattern Sweep

**Goal:** Verify test files follow the skill's testing conventions.

**Method (grep/glob — text patterns and file matching):**
1. **Glob** for each command in `src/commands/` and check if a corresponding test file exists at `test/unit/commands/`
2. **Grep** for `describe(` in test files to check for the 5 required describe blocks with EXACT standard names:
   - `describe("help"` — required in every test file
   - `describe("argument validation"` — required (test required args OR unknown flag rejection)
   - `describe("functionality"` — required (core happy-path tests)
   - `describe("flags"` — required (verify flags exist and work)
   - `describe("error handling"` — required (API errors, network failures)
   Flag non-standard variants: `"command arguments and flags"`, `"command flags"`, `"flag options"`, `"parameter validation"`.
   Exception: `interactive.test.ts`, `interactive-sigint.test.ts`, and `bench/*.test.ts` are exempt.
3. **Grep** for `--duration` in unit test `runCommand()` args — should NOT be present (env var handles it). Exceptions: `test:wait` tests, `interactive-sigint` tests, help output checks.
4. **Grep** for `getMockAblyRealtime`, `getMockAblyRest`, `getMockConfigManager` in test files to verify correct mock usage per command type
5. **Grep** for `--api-key`, `--token`, `--access-token` in unit test files — these should not use CLI auth flags
6. **Check** for use of shared test helpers where applicable:
   - Control API tests should use `nockControl()`, `getControlApiContext()`, `controlApiCleanup()` from `test/helpers/control-api-test-helpers.ts` instead of manual nock setup
   - Control API tests should use mock factories (`mockApp()`, `mockKey()`, `mockRule()`, `mockQueue()`, `mockNamespace()`, `mockStats()`) from `test/fixtures/control-api.ts` instead of duplicating inline response objects
   - Tests with boilerplate help/arg-validation/flags blocks should use `standardHelpTests()`, `standardArgValidationTests()`, `standardFlagTests()` from `test/helpers/standard-tests.ts`
   - Control API error handling blocks should use `standardControlApiErrorTests()` from `test/helpers/standard-tests.ts` for 401/500/network error tests

**Reasoning guidance:**
- Missing test files are deviations but may be documented as known gaps
- Missing describe blocks or non-standard block names are deviations that should be flagged
- Subscribe tests that auto-exit via mocked callbacks (without `--duration`) may be acceptable

### Agent 7: Lifecycle & Convention Sweep

**Goal:** Verify commands use the correct lifecycle helpers and include required metadata.

**Method (grep/read — text patterns):**
1. **Grep** for `waitUntilInterruptedOrTimeout` in command files — should use `this.waitAndTrackCleanup()` instead
2. **Grep** for `setupChannelStateLogging` in subscribe commands (rooms/*, spaces/*) — flag those that don't call it
3. **Grep** for `room.attach()` or `space.enter()` in all rooms/* and spaces/* commands — verify it's only called for commands that need a realtime connection. In the Chat SDK, methods using `this._chatApi.*` are REST (no attach needed), while methods using `this._channel.publish()` or `this._channel.presence.*` need realtime attachment. REST-only: messages send/update/delete/history, occupancy get. Needs attach: presence enter/get/subscribe, typing keystroke/stop, reactions send/subscribe, occupancy subscribe, messages subscribe. Unnecessary attachment adds latency and creates an unneeded realtime connection.
4. **Read** command files and check `static examples` arrays for `--json` or `--pretty-json` examples — flag leaf commands that have examples but no JSON variant
5. **Compare** skill templates (`patterns.md`, `SKILL.md`, `testing.md` — already read in Step 1) against actual codebase method names/imports — flag any outdated patterns

**Method (LSP — for base class verification):**
5. If a subscribe command doesn't call `setupChannelStateLogging` directly, use `LSP goToDefinition` on the base class to check if it's handled there

**Reasoning guidance:**
- `waitUntilInterruptedOrTimeout` in bench commands may be acceptable (different lifecycle)
- Missing `setupChannelStateLogging` in rooms/spaces may be handled by `ChatBaseCommand`/`SpacesBaseCommand` — check the base class
- `room.attach()` in REST-based commands is a deviation. Chat SDK methods using `this._chatApi.*` (messages send/update/delete/history, occupancy get) are pure REST calls. Methods using `this._channel.publish()` or `this._channel.presence.*` (reactions send, typing keystroke, presence enter/get/subscribe, occupancy subscribe, messages subscribe) DO need attachment.
- Topic index commands and `help.ts` don't need `--json` examples
- Skill template accuracy issues are low-effort, high-value fixes

## Step 3: Collect and reason about findings

After all agents complete, compile and **output** findings directly to the user. For each deviation:

1. **State the rule** — which skill checklist item or pattern is violated
2. **State the evidence** — which file, which line, what was found (and which tool was used)
3. **Reason about it** — is this a true deviation, an acceptable exception, or a false positive?
4. **Suggest the fix** — what would the ideal change be to align with the skill

### True deviation criteria

A finding is a **true deviation** if:
- The skill explicitly states a rule and the code violates it
- There is no documented exception for this case
- The fix would not break functionality or require architectural changes beyond the scope

A finding is **NOT a true deviation** if:
- The code has a legitimate reason to differ (e.g., REPL mode, help command without base class access)
- The skill doesn't actually cover this case
- The "violation" is in a base class where the pattern appropriately differs from command-level code

## Output format

Present findings directly to the user in this structure:

### Summary table

| Category | Deviations Found | True Deviations | Exceptions |
|----------|-----------------|-----------------|------------|
| Base Class | N | N | N |
| Error Handling | N | N | N |
| Output Formatting | N | N | N |
| Flag Architecture | N | N | N |
| JSON Output | N | N | N |
| Lifecycle & Conventions | N | N | N |
| Test Patterns | N | N | N |

### Findings by category

For each finding:
- **Rule:** [The skill rule being checked]
- **Evidence:** [File:line, tool used (LSP/grep/read), what was found]
- **Reasoning:** [Why this is/isn't a true deviation]
- **Suggested Fix:** [What to change]
- **Verdict:** TRUE DEVIATION | ACCEPTABLE EXCEPTION | FALSE POSITIVE
