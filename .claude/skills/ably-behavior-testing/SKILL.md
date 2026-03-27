---
name: ably-behavior-testing
description: "Perform behavior testing of Ably CLI commands with full output reports. Use this skill whenever asked to test, validate, or behavior test CLI commands — even casually (e.g., 'test the channels commands', 'run behavior tests on rooms', 'validate the CLI output', 'test all commands', 'test spaces', 'test the control API commands', 'test channels publish and subscribe', 'test ably apps create'). Supports testing at any granularity: a single command (e.g., 'test channels publish'), a subcommand group (e.g., 'test channels presence'), a full command group (e.g., 'test channels'), or the entire CLI. When the user specifies particular commands, test ONLY those — do not expand scope unless asked. Generates reports under CLAUDE-BEHAVIOR-TESTING/<command-group>/: a primary report, human-readable output report, and JSON output report (using --pretty-json). Do NOT use for writing unit tests (use ably-new-command), code review (use ably-review), or codebase audits (use ably-codebase-review)."
---

# Behavior Testing — Ably CLI

You are acting as the **lead expert tester**. Your task is to perform comprehensive behavior testing of Ably CLI commands by executing them against the live Ably service and documenting results in structured Markdown reports.

## When to Use This Skill

- Testing all commands and subcommands under a command group (e.g., `channels`, `rooms`, `spaces`, `apps`)
- Validating `--help` output accuracy and completeness (including topic-level help)
- Verifying subscribe/publish/history workflows end-to-end
- Comparing human-readable vs JSON output formats (using `--pretty-json`)
- Testing Control API commands (apps, auth, queues, integrations)
- Generating test reports for QA review

## Prerequisites

- Authentication is already configured (no need to set access tokens)
- The CLI is built and ready (`pnpm clean && pnpm build` if needed)
- Use `pnpm cli` to run commands (equivalent to `ably`)

---

## Step 0: Confirm Scope with the User

**Before doing any testing**, check whether the user already specified what to test in their message.

- **If the user specified scope** (e.g., "test channels", "test spaces members", "test channels publish and subscribe") → skip this step, go straight to Step 1.
- **If the user did NOT specify scope** (e.g., they just invoked `/ably-behavior-testing` or said "run behavior tests") → ask them to choose.

Present this prompt:

---

**What would you like to test?**

| # | Command Group | API Type | Subcommands |
|---|--------------|----------|-------------|
| 1 | `channels` | Product API | subscribe, publish, history, list, presence, occupancy, annotations, ... |
| 2 | `rooms` | Product API | messages, presence, occupancy, reactions, typing |
| 3 | `spaces` | Product API | members, locations, locks, cursors, occupancy |
| 4 | `logs` | Product API | subscribe, history, channel-lifecycle, connection-lifecycle, push |
| 5 | `apps` | Control API | create, list, update, delete, channel-rules, rules |
| 6 | `auth` | Control API | issue-ably-token, issue-jwt-token, keys |
| 7 | `queues` | Control API | create, list, delete |
| 8 | `integrations` | Control API | create, list, get, update, delete |
| 9 | `push` | Control API | publish, channels, devices, config |
| 10 | `stats` | Control API | app, account |
| 11 | `connections` | Product API | test |
| 12 | **All commands** | All | **Takes a long time — tests every group above sequentially** |

Pick a number, a group name, or tell me specific commands (e.g., "channels publish and subscribe").

---

Wait for the user's response before proceeding. Do NOT start testing until they confirm.

---

## Step 1: Identify Scope

Determine which commands to test based on what the user asked for (either from their original message or from Step 0). The user may specify:

- **Specific commands**: "test channels publish" → test only `channels publish`
- **A subcommand group**: "test channels presence" → test `presence enter`, `presence get`, `presence subscribe`
- **A full command group**: "test channels" → test all channels subcommands
- **Multiple groups**: "test channels and rooms" → test both groups
- **Everything**: "test all commands" → test all groups

**Respect the requested scope.** If the user says "test channels publish and subscribe", do NOT expand to test history, list, presence, etc. Only broaden scope if the user explicitly asks or says "test all".

Consult `references/command-inventory.md` for the complete list organized by API type.

Commands fall into two API categories with different testing patterns:

| API Type | Groups | Auth | Transport |
|----------|--------|------|-----------|
| **Product API** (Ably SDK) | `channels`, `rooms`, `spaces`, `logs`, `connections`, `bench` | API key (`ABLY_API_KEY`) | SDK (REST/Realtime) |
| **Control API** (HTTP) | `accounts`, `apps`, `auth`, `queues`, `integrations`, `push`, `stats`, `channel-rule` | Access token (`ABLY_ACCESS_TOKEN`) | HTTP requests |
| **Local** | `config`, `support`, `version`, `status`, `login` | Varies | Local/mixed |

For each group, enumerate **all** commands and subcommands:

```bash
pnpm cli <group> --help          # Topic-level: lists subcommands
pnpm cli <group> <subcommand> --help  # Command-level: shows flags and usage
```

---

## Step 2: Build a Test Plan

For each command group, organize testing into these categories:

### A. Help Validation

Test **both** topic-level and command-level help:

**Topic-level** (`ably channels --help`):
- Lists all subcommands with descriptions
- Subcommand names match actual available commands
- No missing or extra subcommands

**Command-level** (`ably channels publish --help`):
- USAGE section is present and accurate
- All documented flags appear and descriptions match behavior
- Required arguments are clearly marked
- Examples are valid and runnable
- Flag aliases listed (e.g., `-D` for `--duration`)

### B. Argument and Flag Validation
- Missing required arguments produce clear errors with **non-zero exit code**
- Unknown flags are rejected with suggestion ("Did you mean...?")
- Flag type constraints enforced (e.g., `--limit` with `min: 1`)
- Flag aliases work (short `-D` for `--duration`, `-v` for `--verbose`)
- Default values applied when flags omitted
- Mutually exclusive flags handled (e.g., `--json` and `--pretty-json` together)

### C. Subscribe-First Workflow (for groups with subscribe/publish)

Follow this exact sequence:

1. **Start subscriber** — Run subscribe in background with `--duration`. Wait for output to contain the listening/ready signal (e.g., "Listening" or "Subscribed") before proceeding — do NOT use `sleep`.
2. **Publish data** — In a separate process, publish to the subscribed resource.
3. **Validate receipt** — Confirm subscriber receives the published data with correct format.
4. **Multiple messages** — Publish several messages. Verify all received in order.
5. **Stop subscriber** — Let duration expire or terminate.
6. **Query history** — Run `history` to verify published messages appear.
7. **One-shot queries** — Test `get`, `list`, and other read commands.

### D. Output Format Testing

Every command must be tested in **two modes**:

| Mode | Flag | Format | Use Case |
|------|------|--------|----------|
| Human-readable | (none) | Styled text with labels, colors | Interactive use |
| JSON | `--pretty-json` | Indented, colorized JSON | Scripting, debugging |

> **Why `--pretty-json` only?** The `--json` and `--pretty-json` flags produce identical data — only whitespace/indentation differs. Testing with `--pretty-json` validates all JSON behavior (envelope structure, field parity, stdout cleanliness) while also being easier to read in reports. There is no need to test `--json` separately.

Validate per mode:
- **Human-readable**: Correct formatting, labels, progress messages. No raw JSON leaking. Progress/listening messages present.
- **JSON (`--pretty-json`)**: Valid JSON (verify with `jq`). No human-readable text mixed in (no progress messages, no "Listening..." text). Correct envelope structure. For streaming commands, each event is a valid JSON object.
- **Cross-mode parity**: JSON mode exposes all fields from human-readable (JSON may have more, human-readable must not have fields missing from JSON). Null/undefined fields omitted in both modes.
- **stdout/stderr separation**: In human-readable mode, both data and decoration (progress, success, listening messages) go to stdout. Warnings go to stderr. In `--pretty-json` mode, stdout must contain ONLY valid JSON — decoration is suppressed (not redirected), so piping to `jq` must succeed. Errors go to stderr in all modes.

### E. Error Path Testing
- Invalid arguments → clear error, non-zero exit code
- Nonexistent channels/rooms → appropriate error or empty result
- Missing required flags → error with guidance
- Error output in JSON mode → JSON error envelope (`type: "error"`, `success: false`)
- No stack traces leaked in any mode
- Exit codes: 0 for success, non-zero for errors (document which exit codes appear)

### F. Edge Cases
- Empty channel/room names (should error)
- Special characters in names (`#`, `/`, `%`, spaces)
- Unicode in message data
- Very long messages (>64KB)
- Empty message body
- Pagination boundaries (for history/list with `--limit`)
- Multi-channel subscribe (channels subscribe accepts multiple channel names)

### G. Flag-Specific Testing

Test these flags where applicable (see `references/command-inventory.md` for which commands support each):

| Flag | Test | Verify |
|------|------|--------|
| `--duration N` | Set to 3-5s | Command auto-exits after N seconds, clean exit code 0 |
| `--rewind N` | Subscribe with rewind after publishing | Receives N historical messages on attach |
| `--client-id` | Set custom ID | ID appears in presence/message output |
| `--limit N` | Set on history/list | Returns exactly N items (or fewer if less exist) |
| `--direction` | `forwards` vs `backwards` on history | Order changes |
| `--start` / `--end` | Time range on history | Only items in range returned |
| `--app` | Specify app ID | Overrides default app |
| `--verbose` | Add to any command | Additional debug output on stderr |
| `--force` | On commands that have it (push, apps delete) | Skips confirmation prompt |

---

## Step 3: Execute Tests

### Execution Method

Use the Bash tool to run each command. Capture both stdout and stderr separately to verify stream separation.

**All temporary files** (stdout captures, stderr captures, subscriber output, etc.) must be written under `CLAUDE-BEHAVIOR-TESTING/<command-group>/temp/`. Create this directory at the start of testing a command group. Clean up the `temp/` directory after all reports are generated.

```bash
# Create temp directory at the start of testing a command group
TEMP_DIR="CLAUDE-BEHAVIOR-TESTING/<command-group>/temp"
mkdir -p "$TEMP_DIR"
```

**Pattern for stdout/stderr separation:**
```bash
# Capture stdout and stderr separately
pnpm cli channels list --pretty-json >"$TEMP_DIR/stdout.txt" 2>"$TEMP_DIR/stderr.txt"
echo "Exit code: $?"
echo "=== STDOUT ===" && cat "$TEMP_DIR/stdout.txt"
echo "=== STDERR ===" && cat "$TEMP_DIR/stderr.txt"
# Verify JSON validity
jq . "$TEMP_DIR/stdout.txt" >/dev/null 2>&1 && echo "Valid JSON" || echo "INVALID JSON"
```

**Pattern for subscribe + publish workflow:**
```bash
# Start subscriber with file-based output capture
pnpm cli channels subscribe test-channel --duration 15 >"$TEMP_DIR/sub_stdout.txt" 2>"$TEMP_DIR/sub_stderr.txt" &
SUBSCRIBER_PID=$!

# Wait for ready signal (NOT sleep) — poll for output
for i in $(seq 1 30); do
  if grep -q "Listening\|Subscribed\|Attaching" "$TEMP_DIR/sub_stderr.txt" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

# Publish messages
pnpm cli channels publish test-channel "Hello World 1"
pnpm cli channels publish test-channel "Hello World 2"
pnpm cli channels publish test-channel "Hello World 3"

# Wait for subscriber to finish
wait $SUBSCRIBER_PID
echo "Exit code: $?"
echo "=== Subscriber stdout ===" && cat "$TEMP_DIR/sub_stdout.txt"
echo "=== Subscriber stderr ===" && cat "$TEMP_DIR/sub_stderr.txt"
```

**Pattern for JSON subscribe + publish:**
```bash
pnpm cli channels subscribe test-channel --duration 15 --pretty-json >"$TEMP_DIR/sub_json.txt" 2>"$TEMP_DIR/sub_err.txt" &
SUBSCRIBER_PID=$!

for i in $(seq 1 30); do
  if [ -s "$TEMP_DIR/sub_json.txt" ] || grep -q "Attaching" "$TEMP_DIR/sub_err.txt" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

pnpm cli channels publish test-channel "Hello World 1"
wait $SUBSCRIBER_PID

# Validate JSON validity
jq . "$TEMP_DIR/sub_json.txt" >/dev/null 2>&1 && echo "Valid JSON" || echo "INVALID JSON"
```

### Naming Convention for Test Resources

Use unique, descriptive names to avoid collisions:
- Channels: `behavior-test-<command>-<timestamp>`
- Rooms: `behavior-test-room-<command>-<timestamp>`
- Spaces: `behavior-test-space-<command>-<timestamp>`

### Retry on Network Errors

If a command fails due to network issues, retry once before recording the failure.

### Control API Commands

Control API commands (apps, auth, queues, integrations) behave differently:
- They make HTTP requests, not SDK calls — no subscribe/publish workflows
- They use access tokens, not API keys
- Test CRUD patterns: create → list → get → update → delete
- Verify `--app` flag overrides default app
- Test `--pretty-json` output has correct envelope structure
- Some require `--force` for destructive operations (delete)

---

## Step 4: Generate Reports

All reports are written under `CLAUDE-BEHAVIOR-TESTING/<command-group>/`. For example, testing `channels` produces:

```
CLAUDE-BEHAVIOR-TESTING/
└── channels/
    ├── REPORT_PRIMARY.md
    ├── REPORT_NON_JSON.md
    ├── REPORT_JSON.md
    └── temp/          ← intermediate files (cleaned up after reports are generated)
```

Generate **three** report files:

1. **`REPORT_PRIMARY.md`** — The **primary report**. Contains the consolidated summary of ALL findings (critical, major, minor, and low severity) discovered across both output modes. A reader of this file alone should have the complete picture of every issue found during testing — they should never need to check the per-mode reports to discover additional issues.
2. **`REPORT_NON_JSON.md`** — All commands tested without JSON flags (default human-readable output). Only includes issues specific to human-readable output.
3. **`REPORT_JSON.md`** — All commands tested with `--pretty-json`. Only includes issues specific to JSON output.

After all three reports are generated, **clean up the temp directory**:
```bash
rm -rf "CLAUDE-BEHAVIOR-TESTING/<command-group>/temp"
```

### Primary Report Structure (`REPORT_PRIMARY.md`)

```markdown
# Behavior Test Report — [Command Group]

**Date:** YYYY-MM-DD
**CLI Version:** X.Y.Z
**Tester:** Claude (automated)

## Overall Summary

| Output Mode | Total Tests | Passed | Failed | Skipped |
|-------------|-------------|--------|--------|---------|
| Human-readable | N | N | N | N |
| --pretty-json | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

## All Issues Found

[Every issue found across both output modes, consolidated here. Each entry includes:]
[- Severity (critical/major/minor/low)]
[- Affected command(s)]
[- Description]
[- Which output mode(s) are affected]
[- Steps to reproduce]
[- Expected vs actual behavior]

## Cross-Mode Analysis

[Comparison findings: field parity, JSON envelope correctness, stdout cleanliness]

## Per-Mode Report Links

- [Human-Readable](REPORT_NON_JSON.md)
- [JSON](REPORT_JSON.md)
```

### Per-Mode Report Structure (`REPORT_*.md`)

Use the templates in `references/report-template.md` for each command entry. Each per-mode report follows this structure:

```markdown
# Behavior Test Report — [Command Group] ([Output Mode])

**Date:** YYYY-MM-DD
**CLI Version:** X.Y.Z
**Tester:** Claude (automated)
**Output Mode:** Human-readable / --pretty-json

## Summary

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Help Validation | N | N | N | N |
| Argument Validation | N | N | N | N |
| Functionality | N | N | N | N |
| Output Format | N | N | N | N |
| Error Handling | N | N | N | N |
| JSON Cleanliness | N | N | N | N |

## Issues Found

[Issues specific to THIS output mode only. For the full consolidated list of all issues across all modes, see REPORT_PRIMARY.md.]

## Commands Tested

[Individual command reports follow, separated by ---]
```

---

## Step 5: Analyze and Cross-Reference

After generating both per-mode reports:

1. **Compare across output modes** — For each command, compare both modes:
   - Are the same data fields present across modes?
   - Does `--pretty-json` produce valid JSON?
   - Is stdout clean in JSON mode (no progress messages leaking)?
   - Does JSON output use correct envelope structure (`type`, `command`, `success`, `<domainKey>`)?

2. **Cross-command validation** — Verify workflows span commands:
   - Data published via `publish` appears in `subscribe` output
   - Data published via `publish` appears in `history` output
   - Presence entered via `enter` appears in `get` output
   - Messages sent appear with correct metadata
   - For Control API: resources created via `create` appear in `list`

3. **Consistency checks** (per `references/testing-dimensions.md`):
   - Same flag behaves identically across commands (`--limit`, `--duration`, `--pretty-json`)
   - Same field formatting across commands (timestamps, IDs, labels)
   - Same error patterns across commands (stderr, exit codes, JSON error envelope)

4. **Document issues** — For any failures or inconsistencies:
   - Exact steps to reproduce
   - Expected vs actual behavior
   - Severity assessment (critical/major/minor/low)
   - Which output modes affected

5. **Generate `REPORT_PRIMARY.md`** — After completing the two per-mode reports, create the primary report that consolidates ALL findings (critical, major, minor, and low severity) discovered across both output modes. Each issue entry must specify which output mode(s) it affects. A reader of `REPORT_PRIMARY.md` alone should have the complete picture of every issue found during testing — they should never need to check the per-mode reports to discover additional issues. The per-mode reports (`REPORT_*.md`) should only contain issues specific to that mode and reference `REPORT_PRIMARY.md` for the full list.

6. **Clean up temp directory** — Remove `CLAUDE-BEHAVIOR-TESTING/<command-group>/temp/` after all reports are finalized.

---

## Behavior Testing Dimensions

Beyond basic functional testing, cover these behavior testing dimensions per `references/testing-dimensions.md`:

### Code Path Coverage
- Exercise all conditional branches in flag handling
- Test both REST and Realtime transport paths where applicable
- Test single-item vs batch operations
- Test with and without optional flags (encryption, rewind, client-id)

### State Machine Validation (Long-Running Commands)
- INIT -> CONNECTING -> CONNECTED -> SUBSCRIBED -> RECEIVING -> CLEANUP -> EXIT
- Verify progress messages at each transition (on stderr, not stdout)
- Test clean shutdown via `--duration`

### Output Contract Verification
- JSON envelope: `type`, `command`, `success` fields present
- Domain nesting: data under singular key (events) or plural key (collections)
- Metadata: `total`, `hasMore`, `timestamp` at correct level
- No raw data fields at envelope level
- Streaming: each event independently parseable as JSON (test via `--pretty-json`)

### Output Cleanliness in JSON Mode
- In human-readable mode: both data and decoration (progress, success, listening) go to stdout. Warnings go to stderr.
- In `--pretty-json` mode: decoration is **suppressed** (via `shouldOutputJson` guard), so stdout contains ONLY JSON. Verify: `stdout | jq .` must succeed.
- Errors go to stderr in all modes. Warnings go to stderr in all modes.

### Pagination Testing (history, list commands)
- Default limit behavior
- Custom `--limit` values
- `--direction backwards` vs `forwards`
- `--start` and `--end` time range filters
- `hasMore` indicator accuracy in JSON output
- Pagination hint in JSON when `hasMore` is true

### Exit Code Verification
- 0 for successful operations
- Non-zero for errors (missing args, auth failures, not found)
- 0 for clean exit after `--duration` expires
- Consistent across all commands

---

## Parallel Execution Strategy

For efficiency, spawn parallel agents by command group:

1. **Agent per API type** — One agent for Product API groups (channels, rooms, spaces), one for Control API groups (apps, auth, queues, integrations)
2. **Within each agent** — Test subcommands sequentially where workflows depend on each other (subscribe needs publish first, CRUD needs create first)
3. **Report generation** — Each agent produces its section, combine into final reports

---

## Quality Gates

A command **passes** if:
- `--help` output is accurate and complete (topic-level and command-level)
- All documented flags work as described
- Output format is correct in both modes (human-readable, `--pretty-json`)
- In `--pretty-json` mode, stdout contains only valid JSON (no progress/decoration leaking)
- Exit codes are correct (0 for success, non-zero for errors)
- Error messages are clear and actionable (no stack traces)
- Subscribe/publish workflow delivers messages correctly
- History/get/list queries return expected data
- JSON output (via `--pretty-json`) is valid and parseable (`jq`-friendly)
- Streaming output (via `--pretty-json`) has one valid JSON object per event

A command **fails** if:
- Output is missing fields compared to documentation
- JSON output has incorrect envelope structure
- Human-readable text (progress, listening) leaks into stdout in `--pretty-json` mode
- Error messages are unclear or missing
- Commands crash, hang, or exit with wrong code
- Data published is not received by subscriber
- Pagination produces incorrect results
- Exit code doesn't match success/failure state
