---
name: ably-behavior-testing
description: "Perform behavior testing of Ably CLI commands with full output reports. Use this skill whenever asked to test, validate, or behavior test CLI commands — even casually (e.g., 'test the channels commands', 'run behavior tests on rooms', 'validate the CLI output', 'test all commands', 'test spaces', 'test the control API commands', 'test channels publish and subscribe', 'test ably apps create'). Supports testing at any granularity: a single command (e.g., 'test channels publish'), a subcommand group (e.g., 'test channels presence'), a full command group (e.g., 'test channels'), or the entire CLI. When the user specifies particular commands, test ONLY those — do not expand scope unless asked. Generates reports under CLAUDE-BEHAVIOR-TESTING/<command-group>/: a primary analysis report, a help output report, a human-readable output report, and a JSON output report (using --pretty-json). Do NOT use for writing unit tests (use ably-new-command), code review (use ably-review), or codebase audits (use ably-codebase-review)."
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
- The CLI will be built from source automatically in Step 0a (no manual build needed)
- Use `pnpm cli` to run commands (equivalent to `ably`)

---

## Pre-Flight: Account Tier Check

**This is the very first thing to do when the skill is invoked — before scope selection or any testing.**

Present this prompt:

---

**What tier is the active Ably account?**

| # | Tier | Execution Mode |
|---|------|----------------|
| 1 | **Free** | Commands run **serially** (one at a time) to stay within free-tier rate limits. Context compacted between groups only when usage exceeds 45%. |
| 2 | **Pro** | Commands can run in **parallel** via subagents for faster execution. Multiple command groups may be tested concurrently. |
| 3 | **No account / not logged in** | Cannot run tests. |

Pick 1, 2, or 3.

---

**Based on the response:**

- **Free tier** → Set execution mode to **serial**. Do NOT spawn parallel agents. Between command groups, check context usage with `/context` — if usage exceeds **45%**, run `/compact` before starting the next group. Do NOT compact after every group unconditionally — compaction is expensive and slow, so only trigger it when needed.
- **Pro tier** → Set execution mode to **parallel**. Spawn agents per command group as described in "Execution Strategy — Pro Tier" below.
- **No account** → Stop immediately. Display:
  > Cannot run behavior tests without an active Ably account. Please log in first:
  > ```bash
  > pnpm cli login
  > ```
  > Then re-run this skill.

Wait for the user's response before proceeding. Do NOT continue to scope selection until tier is confirmed.

---

## Step 0: Build & Confirm Scope

### 0a. Ensure Latest Build

Before any testing, build the CLI from the current source to ensure you're testing the latest code:

```bash
pnpm clean && pnpm build
```

**If the build fails**, stop and inform the user:
> Build failed. Cannot proceed with behavior testing until the build is fixed. Here's the error output:
> ```
> [paste build error output]
> ```
> Please fix the build errors and re-run this skill.

**If the build succeeds**, proceed to scope selection.

### 0b. Confirm Scope with the User

**Before doing any testing**, check whether the user already specified what to test in their message.

- **If the user specified scope** (e.g., "test channels", "test spaces members", "test channels publish and subscribe") → skip this step, go straight to Step 1.
- **If the user did NOT specify scope** (e.g., they just invoked `/ably-behavior-testing` or said "run behavior tests") → ask them to choose.

Present this prompt:

---

**What would you like to test?**

| # | Command Group | API Type | Subcommands |
|---|--------------|----------|-------------|
| 1 | `channels` | Product API | subscribe, publish, history, list, presence, occupancy, annotations, batch-publish, append, update, delete |
| 2 | `rooms` | Product API | messages (send, subscribe, history, update, delete, reactions), presence, occupancy, reactions, typing |
| 3 | `spaces` | Product API | create, get, list, subscribe, members, locations, locks, cursors, occupancy |
| 4 | `logs` | Product API | subscribe, history, channel-lifecycle, connection-lifecycle, push |
| 5 | `connections` | Product API | test |
| 6 | `bench` | Product API | publisher, subscriber |
| 7 | `accounts` | Control API | login, logout, current, list, switch |
| 8 | `apps` | Control API | create, list, update, delete, rules, current, switch |
| 9 | `auth` | Control API | issue-ably-token, issue-jwt-token, revoke-token, keys |
| 10 | `queues` | Control API | create, list, delete |
| 11 | `integrations` | Control API | create, list, get, update, delete |
| 12 | `push` | Control API | publish, batch-publish, channels, devices, config (**requires explicit push config — see below**) |
| 13 | `stats` | Control API | app, account |
| 14 | `config` | Local | show, path |
| 15 | `version` | Local | (standalone) |
| 16 | `status` | Local | (standalone) |
| 17 | **All commands** | All | **Tests every group above sequentially (excludes `push` unless explicitly requested)** |

Pick a number, a group name, or tell me specific commands (e.g., "channels publish and subscribe").

---

Wait for the user's response before proceeding. Do NOT start testing until they confirm.

---

## Step 1: Identify Scope and Build Command Checklist

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
| **Control API** (HTTP) | `accounts`, `apps`, `auth`, `queues`, `integrations`, `push`, `stats` | Access token (`ABLY_ACCESS_TOKEN`) | HTTP requests |
| **Local** | `config`, `support`, `version`, `status`, `login` | Varies | Local/mixed |

### Build a Command Checklist

Before starting any testing, enumerate **every** command and subcommand in scope. Use the Step 3 capture pattern for this — the topic-level `--help` runs serve double duty as both checklist discovery AND the first test entries in the report:

```bash
# This captures the help output AND is the first entry in REPORT_HELP.md
D="CLAUDE-BEHAVIOR-TESTING/<group>/temp/<group>-help"; mkdir -p "$D" && pnpm cli <group> --help >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
```

Read the captured stdout to extract the list of subcommands. Then cross-reference with `references/command-inventory.md` and build a checklist of every command to test. Append the help output to REPORT_HELP.md immediately — it's already your first report entry.

This checklist is your contract — every command on it must appear in the per-mode reports with full output.

For example, if testing `channels`, the checklist would be:
- `channels --help` (topic-level)
- `channels publish` + `channels publish --help`
- `channels subscribe` + `channels subscribe --help`
- `channels history` + `channels history --help`
- `channels list` + `channels list --help`
- `channels inspect` + `channels inspect --help`
- `channels batch-publish` + `channels batch-publish --help`
- `channels append` + `channels append --help`
- `channels update` + `channels update --help`
- `channels delete` + `channels delete --help`
- `channels presence --help` (subgroup topic)
- `channels presence enter` + `channels presence enter --help`
- `channels presence get` + `channels presence get --help`
- `channels presence subscribe` + `channels presence subscribe --help`
- `channels occupancy --help` (subgroup topic)
- `channels occupancy get` + `channels occupancy get --help`
- `channels occupancy subscribe` + `channels occupancy subscribe --help`
- `channels annotations --help` (subgroup topic)
- `channels annotations publish` + help
- `channels annotations subscribe` + help
- `channels annotations get` + help
- `channels annotations delete` + help

Every entry gets tested and its output documented. Normal commands are tested in both modes (human-readable → REPORT_NON_JSON.md, `--pretty-json` → REPORT_JSON.md). Help commands (`--help`) are tested once and go to REPORT_HELP.md (help output is mode-independent — separated into its own report to keep functional reports focused). If a command cannot be tested (e.g., requires `mutableMessages`), it still appears in the checklist marked as SKIPPED with the reason — and its `--help` output is still tested and documented in REPORT_HELP.md.

**After generating reports, verify completeness**: every checklist entry must have its corresponding report section(s) — normal commands appear in BOTH REPORT_NON_JSON.md and REPORT_JSON.md, help commands appear in REPORT_HELP.md only. Missing entries mean testing is incomplete.

---

## Step 2: Build a Test Plan

For each command group, organize testing into these categories:

### A. Help Validation (captured in REPORT_HELP.md, analyzed in REPORT_PRIMARY.md)

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

### C. Non-Empty Output Requirement (CRITICAL)

**Every command that reads, queries, or subscribes to data MUST be tested with non-empty output.** A test that only shows a command connecting and returning empty results is **incomplete and counts as a failure**. The purpose of behavior testing is to verify the CLI correctly displays real data — not just that it connects without crashing.

This applies to:
- **Subscribe commands** — MUST receive at least one event/message during the test
- **History commands** — MUST return at least one record
- **Get/get-all commands** — MUST return at least one item
- **List commands** — MUST return at least one item
- **Annotations get** — MUST return at least one annotation
- **Occupancy get** — MUST return non-zero metrics

To achieve this, you must set up prerequisite data **before** running the consuming command. See `references/command-inventory.md` for the exact prerequisites for each command.

**If a command returns empty output, do NOT record it as a pass.** Instead:
1. Run the prerequisite commands to generate data
2. Re-run the consuming command
3. Verify non-empty output
4. Only then record the result

#### Exception: Observe-Only Subscribe Commands

Some subscribe commands listen to **system-generated events** (meta channels, lifecycle events) that have no direct publish counterpart. For these commands, generating events within a short test window is unreliable or requires external infrastructure that may not be available. These are:

| Command | What It Listens To | Why Non-Empty Output Is Unreliable |
|---------|--------------------|------------------------------------|
| `logs subscribe` | `[meta]log` — app-level logs | Meta channel events may not appear within test duration |
| `logs channel-lifecycle subscribe` | `[meta]channel.lifecycle` | Requires channel attach/detach timing to align |
| `logs connection-lifecycle subscribe` | `[meta]connection.lifecycle` | Requires client connect/disconnect timing to align |
| `logs push subscribe` | `[meta]log:push` | Requires push notification infrastructure |
| `channels occupancy subscribe` | Channel occupancy changes | Requires subscriber count changes during test |
| `rooms occupancy subscribe` | Room occupancy changes | Same |
| `spaces occupancy subscribe` | Space occupancy changes | Same |

**For observe-only subscribe commands**, the test passes if:
1. The command connects successfully (progress messages on stderr)
2. The "Listening" / "Subscribed" status message appears on stderr
3. The command exits cleanly after `--duration` with exit code 0
4. In `--pretty-json` mode, the `status: "listening"` JSON event is emitted on stdout
5. The `status: "completed"` signal is emitted on exit in JSON mode

**Non-empty output is a bonus, not a requirement** for these commands. If you happen to capture events (e.g., by running `channels publish` in parallel with `logs subscribe`), great — document them. But empty event output alone is NOT a failure for observe-only subscribe commands.

See `references/command-inventory.md` for which commands are marked as observe-only.

### D. Subscribe-First Workflow (for groups with subscribe/publish)

Follow this exact sequence:

1. **Start subscriber** — Run subscribe in background with `--duration`. Wait for output to contain the listening/ready signal (e.g., "Listening" or "Subscribed") before proceeding — do NOT use `sleep`.
2. **Publish data** — In a separate process, publish to the subscribed resource.
3. **Validate receipt** — Confirm subscriber receives the published data with correct format. **The subscriber MUST have received at least one message/event — empty subscriber output is a test failure.**
4. **Multiple messages** — Publish several messages. Verify all received in order.
5. **Stop subscriber** — Let duration expire or terminate.
6. **Query history** — Run `history` to verify published messages appear. **History MUST return at least one record — empty history is a test failure** (the messages you just published should be there).
7. **One-shot queries** — Test `get`, `list`, and other read commands. **Each MUST return non-empty results** after the data setup above.

### E. Dependency-Chain Testing Patterns

Different command families have different dependency chains. The patterns below illustrate the **execution order** — which commands must run before which to produce non-empty output.

**Important:** These are order/dependency illustrations only. When actually executing, use the Step 3 capture patterns (structured temp directories, stdout/stderr to separate files, Read tool → Edit tool). Every `pnpm cli` command shown below must be captured to its own temp files and written to the report.

#### Pattern 1: Publish → Subscribe → History (channels, rooms messages)
```bash
# 1. Publish data first
pnpm cli channels publish test-ch "Message 1"
pnpm cli channels publish test-ch "Message 2"

# 2. Start subscriber, publish more while it runs
pnpm cli channels subscribe test-ch --duration 15 >"$TEMP_DIR/sub.txt" 2>"$TEMP_DIR/sub_err.txt" &
SUBSCRIBER_PID=$!

# Wait for ready signal (poll stderr for progress message)
for i in $(seq 1 30); do
  if grep -q "Listening\|Subscribed\|Attaching" "$TEMP_DIR/sub_err.txt" 2>/dev/null; then break; fi
  sleep 0.5
done

# Publish while subscriber is running
pnpm cli channels publish test-ch "Message 3"
wait $SUBSCRIBER_PID
# VERIFY: sub.txt MUST contain "Message 3"

# 3. Query history — MUST return records
pnpm cli channels history test-ch --limit 10
# VERIFY: output MUST contain "Message 1", "Message 2", "Message 3"
```

#### Pattern 2: Publish → Annotate → Subscribe → Get (annotations)
```bash
# 1. Publish a message, capture the serial
SERIAL=$(pnpm cli channels publish test-ch "Test message" --json 2>/dev/null | jq -r '.message.serial // .serial // empty')

# 2. Start annotation subscriber in background
pnpm cli channels annotations subscribe test-ch --duration 15 >"$TEMP_DIR/ann_sub.txt" 2>"$TEMP_DIR/ann_err.txt" &
ANN_SUB_PID=$!

# Wait for ready signal
for i in $(seq 1 30); do
  if grep -q "Listening\|Subscribed\|Attaching" "$TEMP_DIR/ann_err.txt" 2>/dev/null; then break; fi
  sleep 0.5
done

# 3. Publish annotations while subscriber is running
pnpm cli channels annotations publish test-ch "$SERIAL" "reactions:unique.v1" --name thumbsup

# Wait for subscriber to finish
wait $ANN_SUB_PID
# VERIFY: ann_sub.txt MUST contain the annotation event

# 4. Get annotations — MUST return non-empty
pnpm cli channels annotations get test-ch "$SERIAL"
# VERIFY: output MUST contain the published annotation
```

#### Pattern 3: Enter/Set/Acquire → Get → Subscribe (presence, spaces)
```bash
# 1. Start hold command in background
pnpm cli channels presence enter test-ch --duration 15 &
ENTER_PID=$!
# Wait for hold signal

# 2. Get — MUST return non-empty
pnpm cli channels presence get test-ch
# VERIFY: output MUST contain the entered member

# 3. Start subscriber, then enter/leave to generate events
pnpm cli channels presence subscribe test-ch --duration 15 >"$TEMP_DIR/pres_sub.txt" 2>"$TEMP_DIR/pres_err.txt" &
pnpm cli channels presence enter test-ch --client-id "test-client-2" --duration 3
# VERIFY: pres_sub.txt MUST contain enter/leave events
```

#### Pattern 4: Mutation Commands (append, update, delete, message reactions)
```bash
# 1. Publish a message to get a serial
SERIAL=$(pnpm cli channels publish test-ch "Original message" --json 2>/dev/null | jq -r '.message.serial // .serial // empty')

# 2. Test mutations using the serial
pnpm cli channels append test-ch "$SERIAL" "Appended text"
pnpm cli channels update test-ch "$SERIAL" "Updated message"
# VERIFY: each mutation returns success output

# 3. For rooms message reactions:
MSG_SERIAL=$(pnpm cli rooms messages send test-room "Test" --json 2>/dev/null | jq -r '.message.serial // .serial // empty')
pnpm cli rooms messages reactions send test-room "$MSG_SERIAL" "👍"
# VERIFY: reaction send returns success
```

#### Pattern 5: Observe-Only Subscribe (no publish counterpart)
```bash
# These subscribe commands listen to system-generated events with no direct publish command.
# Test goal: verify successful subscription lifecycle, NOT non-empty event output.

# 1. Run subscribe with short duration
pnpm cli logs subscribe --duration 10 >"$TEMP_DIR/logs_sub.txt" 2>"$TEMP_DIR/logs_err.txt"
EXIT_CODE=$?

# 2. Verify subscription lifecycle
# VERIFY: stderr contains "Listening" or "Subscribed" progress message
grep -q "Listening\|Subscribed" "$TEMP_DIR/logs_err.txt" && echo "PASS: listening signal" || echo "FAIL: no listening signal"
# VERIFY: exit code is 0 (clean exit after duration)
[ "$EXIT_CODE" -eq 0 ] && echo "PASS: clean exit" || echo "FAIL: exit code $EXIT_CODE"

# 3. JSON mode — verify status events
pnpm cli logs subscribe --duration 10 --pretty-json >"$TEMP_DIR/logs_json.txt" 2>"$TEMP_DIR/logs_json_err.txt"
# VERIFY: stdout contains status:"listening" JSON event
grep -q '"listening"' "$TEMP_DIR/logs_json.txt" && echo "PASS: listening JSON event" || echo "FAIL: no listening JSON"
# VERIFY: stdout contains status:"completed" JSON event
grep -q '"completed"' "$TEMP_DIR/logs_json.txt" && echo "PASS: completed JSON event" || echo "FAIL: no completed JSON"
# VERIFY: all JSON is valid
jq . "$TEMP_DIR/logs_json.txt" >/dev/null 2>&1 && echo "PASS: valid JSON" || echo "FAIL: invalid JSON"

# NOTE: Any events received are a bonus — document them but don't fail on empty.
# Applies to: logs subscribe, logs channel-lifecycle subscribe,
#   logs connection-lifecycle subscribe, logs push subscribe,
#   channels occupancy subscribe, rooms occupancy subscribe, spaces occupancy subscribe
```

#### Pattern 6: CRUD Lifecycle (Control API)
```bash
# 1. Create
pnpm cli apps rules create --name "test-rule" --persisted
# VERIFY: returns created resource with ID

# 2. List — MUST include created resource
pnpm cli apps rules list
# VERIFY: output MUST contain "test-rule"

# 3. Update
pnpm cli apps rules update test-rule --push-enabled
# VERIFY: returns updated resource

# 4. Delete
pnpm cli apps rules delete test-rule --force
# VERIFY: returns success, no longer in list
```

### F. Output Format Testing

Every command must be tested in **two modes**:

| Mode | Flag | Format | Use Case |
|------|------|--------|----------|
| Human-readable | (none) | Styled text with labels, colors | Interactive use |
| JSON | `--pretty-json` | Indented, colorized JSON | Scripting, debugging |

> **Why `--pretty-json` only?** The `--json` and `--pretty-json` flags produce identical data — only whitespace/indentation differs. Testing with `--pretty-json` validates all JSON behavior (envelope structure, field parity, stdout cleanliness) while also being easier to read in reports. There is no need to test `--json` separately.

Validate per mode:
- **Human-readable**: Correct formatting, labels. No raw JSON leaking. Progress/listening messages present on stderr.
- **JSON (`--pretty-json`)**: Valid JSON (verify with `jq`). No human-readable text mixed in (no progress messages, no "Listening..." text). Correct envelope structure. For streaming commands, each event is a valid JSON object.
- **Cross-mode parity**: JSON mode exposes all fields from human-readable (JSON may have more, human-readable must not have fields missing from JSON). Null/undefined fields omitted in both modes.
- **stdout/stderr separation**: In human-readable mode, data output goes to stdout and status/decoration messages (progress, success, listening, holding, warnings) go to stderr via the logging helpers (`logProgress`, `logSuccessMessage`, `logListening`, `logHolding`, `logWarning`). In `--pretty-json` mode, `logProgress` and `logSuccessMessage` are silent (no-ops), `logListening`/`logHolding`/`logWarning` emit structured JSON on stdout, and data output is JSON on stdout — piping to `jq` must succeed. Errors go to stderr in all modes.

### G. Error Path Testing
- Invalid arguments → clear error, non-zero exit code
- Nonexistent channels/rooms → appropriate error or empty result
- Missing required flags → error with guidance
- Error output in JSON mode → JSON error envelope (`type: "error"`, `success: false`)
- No stack traces leaked in any mode
- Exit codes: 0 for success, non-zero for errors (document which exit codes appear)

### H. Edge Cases
- Empty channel/room names (should error)
- Special characters in names (`#`, `/`, `%`, spaces)
- Unicode in message data
- Very long messages (>64KB)
- Empty message body
- Pagination boundaries (for history/list with `--limit`)
- Multi-channel subscribe (channels subscribe accepts multiple channel names)

### I. Flag-Specific Testing

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

## Step 3: Execute Tests and Build Reports Incrementally

### Core Principle: Execute → Capture → Write → Next

Do NOT batch all executions first and write reports later. That workflow loses output to context compression and leads to abbreviated reports. Instead, follow this tight loop for every command:

1. **Execute** the command, capturing stdout/stderr to temp files
2. **Read** the temp files using the Read tool
3. **Append** the command's section to the report file immediately (using Edit or Write)
4. **Move on** to the next command

This means reports are built incrementally as tests run. By the time all commands are tested, the per-mode reports are already complete — no need for a separate "generate reports" pass.

### Directory Setup

At the start of testing a command group, create the report directory and initialize the execution manifest:

```bash
mkdir -p "CLAUDE-BEHAVIOR-TESTING/<command-group>/temp"
```

### Execution Manifest (`manifest.json`)

Every command group maintains a `manifest.json` at `CLAUDE-BEHAVIOR-TESTING/<command-group>/manifest.json`. This is the single source of truth for what was executed, where outputs live, and whether they passed integrity checks. Initialize it at the start of testing:

```json
{
  "commandGroup": "<group>",
  "startedAt": "<ISO-8601 timestamp>",
  "cliVersion": "<version from pnpm cli --version>",
  "executionMode": "serial|parallel",
  "executions": []
}
```

After each command execution completes (Step A+B), append an entry to `executions`:

```json
{
  "id": "channels-publish",
  "command": "pnpm cli channels publish behavior-test-ch-1234 \"Hello World\"",
  "tempDir": "CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-publish",
  "timestamp": "<ISO-8601 when executed>",
  "mode": "human-readable|json|help|error",
  "reportFile": "REPORT_HELP.md|REPORT_NON_JSON.md|REPORT_JSON.md",
  "files": {
    "stdout": { "path": "stdout.txt", "bytes": 342, "lines": 8 },
    "stderr": { "path": "stderr.txt", "bytes": 87, "lines": 2 },
    "exitcode": { "path": "exitcode.txt", "value": 0 }
  },
  "validation": {
    "stdoutExists": true,
    "stderrExists": true,
    "exitcodeExists": true,
    "jsonValid": true,
    "streamClean": true,
    "truncated": false
  },
  "reportSectionWritten": true
}
```

The manifest enables:
- **Deterministic completeness verification** — cross-check manifest entries against the Step 1 checklist
- **Integrity auditing** — every execution has recorded file sizes and validation status
- **Traceability** — timestamps and temp directory paths link reports back to raw artifacts
- **Debugging** — if a report section looks wrong, trace it back to the exact temp files

Update the manifest after each execution's post-capture validation (Step B2 below). At the end of testing, finalize with `"completedAt"` timestamp and `"totalExecutions"` count.

### Temp File Naming Convention

Each command execution creates a subdirectory under `temp/` with a predictable name. Each directory contains exactly `timestamp.txt`, `stdout.txt`, `stderr.txt`, and `exitcode.txt` — one file per stream, never shared across commands.

```
temp/
├── channels-help/              # Topic help
│   ├── timestamp.txt
│   ├── stdout.txt
│   ├── stderr.txt
│   └── exitcode.txt
├── channels-publish-help/      # Command help
│   ├── timestamp.txt
│   ├── stdout.txt
│   ├── stderr.txt
│   └── exitcode.txt
├── channels-publish/           # Human-readable execution
│   ├── timestamp.txt
│   ├── stdout.txt
│   ├── stderr.txt
│   └── exitcode.txt
├── channels-publish-json/      # JSON execution (same command with --pretty-json)
│   ├── timestamp.txt
│   ├── stdout.txt
│   ├── stderr.txt
│   └── exitcode.txt
├── channels-subscribe/         # Subscribe workflow (multiple commands, isolated files)
│   ├── timestamp.txt           # When the workflow started
│   ├── readiness_check.txt     # READY or READINESS_TIMEOUT
│   ├── sub_stdout.txt          # Subscriber stdout only
│   ├── sub_stderr.txt          # Subscriber stderr only
│   ├── sub_exitcode.txt        # Subscriber exit code
│   ├── pub1_stdout.txt         # Publish 1 stdout only
│   ├── pub1_stderr.txt         # Publish 1 stderr only
│   ├── pub2_stdout.txt         # Publish 2 stdout only
│   ├── pub2_stderr.txt         # Publish 2 stderr only
│   ├── pub3_stdout.txt         # Publish 3 stdout only
│   └── pub3_stderr.txt         # Publish 3 stderr only
└── ...
```

**Naming rules:**
- Directory: `<command-path-with-dashes>[-json][-flags]` — e.g., `channels-presence-enter`, `channels-history-limit-1`, `channels-publish-json`
- One-shot commands: always `stdout.txt`, `stderr.txt`, `exitcode.txt`
- Multi-command workflows: prefix each file with the role — `sub_`, `pub1_`, `pub2_`, `enter_`, etc.

### Isolation Rule: One Command = One Bash Call = One Temp Directory

Each command execution must be its own separate Bash tool call with its own temp directory. This prevents stdout/stderr from different commands mixing together. Never run two `pnpm cli` commands in the same Bash call unless they are part of a workflow where one MUST run while another is active (subscribe + publish). Even then, each command's output goes to different files within the shared temp directory.

### Execution + Immediate Report Writing — The 4-Step Loop

For every command, follow this exact 4-step sequence using separate tool calls:

**Step A: Execute and capture (Bash tool)**

One Bash tool call that creates the temp directory, records a timestamp, runs the command, and captures everything to files:

```bash
D="CLAUDE-BEHAVIOR-TESTING/<group>/temp/channels-publish"; mkdir -p "$D" && date -u +%Y-%m-%dT%H:%M:%SZ > "$D/timestamp.txt" && pnpm cli channels publish behavior-test-ch-1234 "Hello World" >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
```

Key details:
- `mkdir -p` + timestamp + command + exitcode capture are chained in ONE Bash call
- `timestamp.txt` records when the command executed — this enables correlation across concurrent workflows and debugging timing-sensitive failures
- stdout goes to `stdout.txt`, stderr goes to `stderr.txt` — they are **physically separate files**, one fd per file, they cannot mix
- `echo $?` is chained with `;` (not `&&`) immediately after the redirect — this ensures `$?` captures the `pnpm cli` exit code even if the command fails, not any other command's exit code
- After this Bash call completes, four files exist: `timestamp.txt`, `stdout.txt`, `stderr.txt`, `exitcode.txt`
- The Bash tool response itself will be nearly empty (all output went to files) — this is correct

**Step B: Post-Capture Validation (Bash tool)**

Immediately after capture, run a validation check that records file sizes, detects truncation risks, and validates JSON integrity. This is a single Bash call:

```bash
D="CLAUDE-BEHAVIOR-TESTING/<group>/temp/<command-name>"
echo "=== POST-CAPTURE VALIDATION ==="
echo "stdout_bytes=$(wc -c < "$D/stdout.txt" 2>/dev/null || echo 0)"
echo "stdout_lines=$(wc -l < "$D/stdout.txt" 2>/dev/null || echo 0)"
echo "stderr_bytes=$(wc -c < "$D/stderr.txt" 2>/dev/null || echo 0)"
echo "stderr_lines=$(wc -l < "$D/stderr.txt" 2>/dev/null || echo 0)"
echo "exitcode=$(cat "$D/exitcode.txt" 2>/dev/null || echo MISSING)"
# Truncation warning: Read tool default is 2000 lines
STDOUT_LINES=$(wc -l < "$D/stdout.txt" 2>/dev/null || echo 0)
if [ "$STDOUT_LINES" -gt 1800 ]; then echo "WARNING: stdout has $STDOUT_LINES lines — may be truncated by Read tool (limit 2000). Use offset/limit parameters."; fi
```

For `--pretty-json` captures, also validate JSON and check for stream contamination:

```bash
# JSON validity check (mandatory for --pretty-json captures)
if jq . "$D/stdout.txt" >/dev/null 2>&1; then
  echo "json_valid=true"
else
  echo "json_valid=false — STREAM CONTAMINATION or MALFORMED JSON"
  echo "First non-JSON line:"
  grep -n -v '^\s*[{\["\]}0-9tfn]' "$D/stdout.txt" | head -1
fi
# Stream contamination: check for human-readable progress text in stdout
if grep -qiE '(Attaching to|Listening for|Press Ctrl|Published|✓)' "$D/stdout.txt" 2>/dev/null; then
  echo "stream_clean=false — progress/status text detected in stdout"
else
  echo "stream_clean=true"
fi
```

Record these values in the manifest entry for this execution. These metrics serve three purposes:
1. **Truncation detection** — if stdout exceeds 1800 lines, use `offset` and `limit` parameters on the Read tool to capture in chunks
2. **JSON integrity** — a failed `jq` check means either the command emitted non-JSON to stdout or streams were interleaved
3. **Stream contamination** — human-readable progress text in stdout during JSON mode is a bug to report

**Step B2: Read temp files (Read tool — separate calls)**

Use the Read tool to read each temp file. This returns exact file contents that will be copied into the report.

- Read `stdout.txt` — if the file is empty, the Read tool returns a warning about empty contents. In that case, write `(empty)` in the report.
- Read `stderr.txt` — same empty handling.
- Read `exitcode.txt` — always a single number.
- **If stdout exceeds 1800 lines** (detected in Step B), read in chunks using `offset` and `limit` parameters. Concatenate all chunks in the report section. Never silently truncate.

**The temp files are the ONLY source of truth for report content.** Do NOT use the Bash tool's response text as report content — it may be empty, truncated, or contain shell diagnostics. Always Read the temp files.

**Step C: Append section to report (Edit tool)**

Using the Edit tool, append the command's section to the report file. Copy the Read output verbatim — do not paraphrase, summarize, or abbreviate.

```markdown
---

### `ably channels publish`

**Command:**
\`\`\`bash
pnpm cli channels publish behavior-test-ch-1234 "Hello World"
\`\`\`

**Execution Metadata:**
- Timestamp: [from timestamp.txt]
- stdout: [N bytes, N lines] | stderr: [N bytes, N lines]
- JSON valid: [yes/no/n/a] | Stream clean: [yes/no/n/a]

**stdout:**
\`\`\`
[EXACT contents from Read of stdout.txt — or "(empty)" if file was empty]
\`\`\`

**stderr:**
\`\`\`
[EXACT contents from Read of stderr.txt — or "(empty)" if file was empty]
\`\`\`

**Exit Code:** [contents of exitcode.txt]

---
```

The **Execution Metadata** line uses values from the Step B post-capture validation. For help commands, JSON valid and Stream clean are `n/a`. This metadata is critical for report integrity — it enables downstream verification that report content matches what was actually captured.

**Step D: Next command.** Do NOT proceed until Steps A-C are complete for the current command.

### Pattern: One-Shot Commands (publish, list, get, history, help, errors)

Each execution is one Bash call, one Read pass, one Edit append:

```bash
# Human-readable
D="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-list"; mkdir -p "$D" && date -u +%Y-%m-%dT%H:%M:%SZ > "$D/timestamp.txt" && pnpm cli channels list --limit 5 >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
```
→ Post-capture validation → Read temp files → Append to REPORT_NON_JSON.md

```bash
# JSON (separate Bash call, separate temp dir)
D="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-list-json"; mkdir -p "$D" && date -u +%Y-%m-%dT%H:%M:%SZ > "$D/timestamp.txt" && pnpm cli channels list --limit 5 --pretty-json >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
```
→ Post-capture validation (including JSON + stream checks) → Read temp files → Append to REPORT_JSON.md

### Pattern: Subscribe + Publish Workflow

This is the ONE case where multiple `pnpm cli` commands run in the same Bash call, because the subscriber must be active while publish runs. Each command's output goes to SEPARATE files within the temp directory:

```bash
CMD_DIR="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-subscribe"
mkdir -p "$CMD_DIR"
date -u +%Y-%m-%dT%H:%M:%SZ > "$CMD_DIR/timestamp.txt"

# Subscriber output → its own files
pnpm cli channels subscribe test-channel --duration 15 >"$CMD_DIR/sub_stdout.txt" 2>"$CMD_DIR/sub_stderr.txt" &
SUB_PID=$!

# Wait for ready signal with explicit timeout detection
READY=false
for i in $(seq 1 30); do
  if grep -q "Listening\|Subscribed" "$CMD_DIR/sub_stderr.txt" 2>/dev/null; then READY=true; break; fi
  sleep 0.5
done
if [ "$READY" = false ]; then
  echo "READINESS_TIMEOUT: subscriber did not emit ready signal within 15s" > "$CMD_DIR/readiness_check.txt"
  echo "stderr contents at timeout:" >> "$CMD_DIR/readiness_check.txt"
  cat "$CMD_DIR/sub_stderr.txt" >> "$CMD_DIR/readiness_check.txt" 2>/dev/null
else
  echo "READY: subscriber signaled readiness" > "$CMD_DIR/readiness_check.txt"
fi

# Each publish → its own files (stdout and stderr NEVER mix with subscriber or each other)
pnpm cli channels publish test-channel "Message 1" >"$CMD_DIR/pub1_stdout.txt" 2>"$CMD_DIR/pub1_stderr.txt"
pnpm cli channels publish test-channel "Message 2" >"$CMD_DIR/pub2_stdout.txt" 2>"$CMD_DIR/pub2_stderr.txt"
pnpm cli channels publish test-channel "Message 3" >"$CMD_DIR/pub3_stdout.txt" 2>"$CMD_DIR/pub3_stderr.txt"

wait $SUB_PID
echo $? > "$CMD_DIR/sub_exitcode.txt"
```

**Readiness timeout handling:** If `readiness_check.txt` contains `READINESS_TIMEOUT`, this is an issue to investigate — the subscriber may have failed to connect, or the ready signal pattern changed. Include the readiness check result in the manifest entry. Continue with publish anyway (the subscriber might still be connecting), but flag the timeout in REPORT_PRIMARY.md as a potential issue.

After execution, the temp directory contains fully isolated files — subscriber, each publish, and workflow metadata:
```
channels-subscribe/
├── timestamp.txt        # When the workflow started
├── readiness_check.txt  # READY or READINESS_TIMEOUT with details
├── sub_stdout.txt       # Subscriber stdout (received messages)
├── sub_stderr.txt       # Subscriber stderr (progress messages)
├── sub_exitcode.txt     # Subscriber exit code
├── pub1_stdout.txt      # Publish 1 stdout (serial)
├── pub1_stderr.txt      # Publish 1 stderr (success message)
├── pub2_stdout.txt      # Publish 2 stdout
├── pub2_stderr.txt      # Publish 2 stderr
├── pub3_stdout.txt      # Publish 3 stdout
└── pub3_stderr.txt      # Publish 3 stderr
```

Read ALL of them, then write the report section including every output:

```markdown
---

### `ably channels subscribe` (with concurrent publish)

**Subscribe Command:**
\`\`\`bash
pnpm cli channels subscribe test-channel --duration 15
\`\`\`

**Publish 1:**
Command: \`pnpm cli channels publish test-channel "Message 1"\`
stdout: \`\`\`[from pub1_stdout.txt]\`\`\`
stderr: \`\`\`[from pub1_stderr.txt]\`\`\`

**Publish 2:**
Command: \`pnpm cli channels publish test-channel "Message 2"\`
stdout: \`\`\`[from pub2_stdout.txt]\`\`\`
stderr: \`\`\`[from pub2_stderr.txt]\`\`\`

**Publish 3:**
Command: \`pnpm cli channels publish test-channel "Message 3"\`
stdout: \`\`\`[from pub3_stdout.txt]\`\`\`
stderr: \`\`\`[from pub3_stderr.txt]\`\`\`

**Subscriber stdout:**
\`\`\`
[from sub_stdout.txt]
\`\`\`

**Subscriber stderr:**
\`\`\`
[from sub_stderr.txt]
\`\`\`

**Subscriber Exit Code:** [from sub_exitcode.txt]

---
```

### Pattern: JSON Subscribe + Publish

Same as above, but with `--pretty-json` on the subscriber and a separate temp directory:

```bash
CMD_DIR="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-subscribe-json"
mkdir -p "$CMD_DIR"
date -u +%Y-%m-%dT%H:%M:%SZ > "$CMD_DIR/timestamp.txt"

pnpm cli channels subscribe test-channel --duration 15 --pretty-json >"$CMD_DIR/sub_stdout.txt" 2>"$CMD_DIR/sub_stderr.txt" &
SUB_PID=$!

# In JSON mode, readiness is signaled by a "listening" status JSON event on stdout
# OR progress text on stderr (stderr is unaffected by --pretty-json)
READY=false
for i in $(seq 1 30); do
  if grep -q '"listening"' "$CMD_DIR/sub_stdout.txt" 2>/dev/null || grep -q "Attaching\|Listening" "$CMD_DIR/sub_stderr.txt" 2>/dev/null; then READY=true; break; fi
  sleep 0.5
done
if [ "$READY" = false ]; then
  echo "READINESS_TIMEOUT" > "$CMD_DIR/readiness_check.txt"
else
  echo "READY" > "$CMD_DIR/readiness_check.txt"
fi

pnpm cli channels publish test-channel "Message 1" >"$CMD_DIR/pub1_stdout.txt" 2>"$CMD_DIR/pub1_stderr.txt"

wait $SUB_PID
echo $? > "$CMD_DIR/sub_exitcode.txt"
```
→ Read all files → Append to REPORT_JSON.md (same section format as above)

### Pattern: Hold Workflow (presence enter/get, spaces members/locations/locks/cursors)

Hold commands run in background while get/subscribe run against them. Like subscribe+publish, all outputs go to separate files:

```bash
CMD_DIR="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-presence-workflow"
mkdir -p "$CMD_DIR"
date -u +%Y-%m-%dT%H:%M:%SZ > "$CMD_DIR/timestamp.txt"

# Hold command runs in background — its output isolated to its own files
pnpm cli channels presence enter test-channel --client-id "test-user" --duration 20 >"$CMD_DIR/enter_stdout.txt" 2>"$CMD_DIR/enter_stderr.txt" &
ENTER_PID=$!

# Wait for hold signal with timeout detection
READY=false
for i in $(seq 1 30); do
  if grep -q "Holding\|Entered\|presence" "$CMD_DIR/enter_stderr.txt" 2>/dev/null; then READY=true; break; fi
  sleep 0.5
done
echo "$( [ "$READY" = true ] && echo READY || echo READINESS_TIMEOUT ):enter" > "$CMD_DIR/readiness_check.txt"

# Get — isolated to its own files
pnpm cli channels presence get test-channel >"$CMD_DIR/get_stdout.txt" 2>"$CMD_DIR/get_stderr.txt"; echo $? > "$CMD_DIR/get_exitcode.txt"

# Subscribe in background — isolated to its own files
pnpm cli channels presence subscribe test-channel --duration 10 >"$CMD_DIR/sub_stdout.txt" 2>"$CMD_DIR/sub_stderr.txt" &
SUB_PID=$!

READY=false
for i in $(seq 1 30); do
  if grep -q "Listening\|Subscribed" "$CMD_DIR/sub_stderr.txt" 2>/dev/null; then READY=true; break; fi
  sleep 0.5
done
echo "$( [ "$READY" = true ] && echo READY || echo READINESS_TIMEOUT ):subscribe" >> "$CMD_DIR/readiness_check.txt"

# Enter with different client to generate events — isolated
pnpm cli channels presence enter test-channel --client-id "test-user-2" --duration 3 >"$CMD_DIR/enter2_stdout.txt" 2>"$CMD_DIR/enter2_stderr.txt"

wait $SUB_PID
echo $? > "$CMD_DIR/sub_exitcode.txt"
wait $ENTER_PID
echo $? > "$CMD_DIR/enter_exitcode.txt"
```

Result: fully isolated files, each containing output from exactly one command, zero mixing:
```
channels-presence-workflow/
├── timestamp.txt, readiness_check.txt
├── enter_stdout.txt, enter_stderr.txt, enter_exitcode.txt
├── get_stdout.txt, get_stderr.txt, get_exitcode.txt
├── sub_stdout.txt, sub_stderr.txt, sub_exitcode.txt
└── enter2_stdout.txt, enter2_stderr.txt
```
→ Read ALL files → Write workflow section to report covering each command's output

### Pattern: Serial Extraction (publish → capture serial → mutation)

When a mutation command needs a serial from a prior publish, capture the publish output to temp files AND extract the serial:

```bash
# Step 1: Publish and capture full output
D="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-publish-for-serial"; mkdir -p "$D" && pnpm cli channels publish test-channel "Original message" --json >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
```

Then in a SEPARATE Bash call, extract the serial from the captured file:
```bash
SERIAL=$(cat "CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-publish-for-serial/stdout.txt" | jq -r '.publish.results[0].serial // .serial // empty')
echo "Extracted serial: $SERIAL"
```

Then use the serial in mutation commands (each captured to its own temp dir):
```bash
D="CLAUDE-BEHAVIOR-TESTING/channels/temp/channels-append"; mkdir -p "$D" && pnpm cli channels append test-channel "$SERIAL" "Appended text" >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
```

This way: (a) the publish output is fully captured and goes in the report, (b) the serial is extracted from the captured file not from a transient Bash pipeline, and (c) each mutation is independently captured.

### Universal Capture Rule

**Every `pnpm cli` invocation — without exception — must be captured to temp files and have a corresponding section in the appropriate report.** This includes:
- Help commands (`--help`) → **REPORT_HELP.md**
- Primary command tests (publish, subscribe, history, list, get, etc.) → **REPORT_NON_JSON.md**
- JSON-mode re-runs (`--pretty-json`) → **REPORT_JSON.md**
- Flag variation tests (`--limit 1`, `--direction forwards`) → both REPORT_NON_JSON.md and REPORT_JSON.md
- Error path tests (missing args, invalid flags) → both REPORT_NON_JSON.md and REPORT_JSON.md
- Prerequisite/setup commands (publish before history, enter before get) → both
- Publish commands run during subscribe workflows → REPORT_NON_JSON.md (and REPORT_JSON.md for the JSON subscribe workflow)
- Skipped commands → help in REPORT_HELP.md, error path in REPORT_NON_JSON.md and REPORT_JSON.md

If a `pnpm cli` command was executed but its output doesn't appear in any report, something was missed. The manifest tracks every execution and its target report file.

### Which Report Gets Each Command

| Command Type | REPORT_HELP.md | REPORT_NON_JSON.md | REPORT_JSON.md |
|-------------|---------------|-------------------|----------------|
| `--help` commands (topic-level and command-level) | Yes | No | No |
| Normal commands (publish, list, get, etc.) | No | Yes | Yes (re-run with `--pretty-json`) |
| Subscribe workflows | No | Yes | Yes (re-run with `--pretty-json`) |
| Error paths (missing args, invalid flags) | No | Yes | Yes (re-run with `--pretty-json` to verify JSON error envelope) |
| Flag variations (`--limit`, `--direction`) | No | Yes | Yes |
| Prerequisite commands (publish before history) | No | Yes — they produce output too | Yes |
| Skipped commands (error path output) | No | Yes — SKIPPED note + error output | Yes — SKIPPED note + JSON error output |
| Skipped commands (help output) | Yes — `--help` always captured | No | No |

### Testing Flow for Each Checklist Item

For each command in the checklist:
1. Run `<command> --help` → capture → append to **REPORT_HELP.md**
2. Run command in human-readable mode → capture → append to REPORT_NON_JSON.md
3. Run command in JSON mode (`--pretty-json`) → capture → append to REPORT_JSON.md
4. If applicable, test flag variations in both modes → capture → append to respective reports
5. Move to next command

This keeps related output close in context and ensures all three reports get populated together. Help output is deliberately separated into its own report because help commands are numerous (every command + subgroup gets `--help`) and mode-independent — mixing them into REPORT_NON_JSON.md dilutes the functional test evidence.

### Skipped Commands

If a command cannot be tested due to a missing configuration (e.g., `mutableMessages` not enabled, push config not set), this is still valuable test data:

1. **Run the command anyway** — capture its error output using the standard capture pattern. The error message itself is what we're testing.
2. **Record it as an issue if the error doesn't tell the user how to fix it.** A good CLI error should include actionable guidance — e.g., "Enable mutableMessages using `ably apps rules update <namespace> --persist-last-message-enabled`". If the error just says "feature not enabled" without showing the CLI command to enable it, that's a usability issue to log in REPORT_PRIMARY.md.
3. **Mark the command as SKIPPED for functional testing** — but the error path IS tested and documented.

**In REPORT_HELP.md** — the `--help` output for the skipped command is still captured as a normal help entry (see Help Command template).

**In REPORT_NON_JSON.md** — error output + SKIPPED note (no help — that goes to REPORT_HELP.md):
```markdown
---

### `ably channels append` — SKIPPED (functional) / TESTED (error path)

**Reason:** Requires `mutableMessages` enabled on channel namespace (not configured on test app).

**Error output (attempted execution):**

**Command:**
\`\`\`bash
pnpm cli channels append test-ch "serial" "text"
\`\`\`

**stdout:**
\`\`\`
[verbatim stdout from the failed attempt]
\`\`\`

**stderr:**
\`\`\`
[verbatim stderr — the error message IS the test subject here]
\`\`\`

**Exit Code:** [non-zero]

---
```

**In REPORT_JSON.md** — same error output with `--pretty-json` to verify JSON error envelope:
```markdown
---

### `ably channels append --pretty-json` — SKIPPED (functional) / TESTED (error path)

**Reason:** Requires `mutableMessages` enabled on channel namespace (not configured on test app).

**Command:**
\`\`\`bash
pnpm cli channels append test-ch "serial" "text" --pretty-json
\`\`\`

**stdout:**
\`\`\`
[verbatim stdout — should be JSON error envelope]
\`\`\`

**stderr:**
\`\`\`
[verbatim stderr]
\`\`\`

**Exit Code:** [non-zero]

---
```

**In REPORT_PRIMARY.md** — if the error message lacks actionable guidance, log it as an issue:
```markdown
### Issue N: `channels append` error doesn't tell user how to enable mutableMessages (Minor/Major)

- **Severity:** Minor or Major (depending on how opaque the error is)
- **Affected command(s):** `channels append`, `channels update`, `channels delete` (and any others requiring the same config)
- **Affected mode(s):** Both
- **Description:** When `mutableMessages` is not enabled, the error message should include the CLI command to enable it (e.g., `ably apps rules update <namespace> --persist-last-message-enabled`). If it only says "feature not enabled" or links to a generic help page without CLI-specific guidance, users are left guessing.
- **Expected:** Error includes actionable CLI command to resolve the issue.
- **Actual:** [describe what the error actually says]
```

### Report File Initialization

Before starting the execute-capture-write loop, use the Write tool (not Bash heredoc) to create all three report files with their headers. This avoids shell variable scoping issues:

Write `CLAUDE-BEHAVIOR-TESTING/<command-group>/REPORT_HELP.md`:
```markdown
# [Command Group] — Help Output

**Date:** YYYY-MM-DD
**CLI Version:** X.Y.Z
**Output Mode:** --help (mode-independent)
```

Write `CLAUDE-BEHAVIOR-TESTING/<command-group>/REPORT_NON_JSON.md`:
```markdown
# [Command Group] — Human-Readable Output

**Date:** YYYY-MM-DD
**CLI Version:** X.Y.Z
**Output Mode:** Human-readable
```

Write `CLAUDE-BEHAVIOR-TESTING/<command-group>/REPORT_JSON.md`:
```markdown
# [Command Group] — JSON Output

**Date:** YYYY-MM-DD
**CLI Version:** X.Y.Z
**Output Mode:** --pretty-json
```

Then each command's section is appended via Edit as tests run.

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

### Control API Cleanup (MANDATORY)

**Every Control API command group that creates resources MUST clean up after itself.** Leaving test resources behind pollutes the account and can cause issues for subsequent test runs. After testing a CRUD group, delete all resources created during the test.

| Command Group | Create Command | Cleanup Command | Notes |
|---------------|---------------|-----------------|-------|
| `apps` | `apps create` | `apps delete --force` | Delete test apps created during testing. Do NOT delete the user's existing apps. |
| `apps rules` | `apps rules create` | `apps rules delete` | Delete test rules created during testing. |
| `auth keys` | `auth keys create` | `auth keys revoke` | Revoke test keys. Do NOT revoke the default key. |
| `queues` | `queues create` | `queues delete` | Delete test queues. |
| `integrations` | `integrations create` | `integrations delete` | Delete test integrations. |

**Cleanup pattern:**
1. Capture the ID/name of every resource you create during testing (from the create command output)
2. After all tests for the group are complete, delete each created resource
3. Verify deletion succeeded (resource no longer appears in list)
4. Record cleanup results in the report

If cleanup fails, **log it as an issue in the report** — leftover test resources are a problem.

### Push Command Group — Restricted

**Never run the `push` command group unless the user explicitly requests it.** Push commands require explicit push notification configuration (APNs certificates, FCM service accounts) that most test environments don't have.

Even when "test all commands" is selected (option 17), **skip `push` entirely** unless the user specifically includes it.

**If the user explicitly requests push testing:**

1. First verify push configuration exists (capture the output — it becomes the first report entry for push):
   ```bash
   D="CLAUDE-BEHAVIOR-TESTING/push/temp/push-config-show"; mkdir -p "$D" && pnpm cli push config show >"$D/stdout.txt" 2>"$D/stderr.txt"; echo $? > "$D/exitcode.txt"
   ```
2. Read `stdout.txt`. If the output shows no APNs or FCM configuration → stop and inform the user:
   > Push notification testing requires APNs or FCM configuration. Run `ably push config set-apns` or `ably push config set-fcm` first, then re-run push tests.
3. Only proceed with push testing after confirming configuration is present.
4. Test `push config show` first, then other push commands.

---

## Step 4: Generate REPORT_PRIMARY.md (Analysis)

By this point, `REPORT_HELP.md`, `REPORT_NON_JSON.md`, and `REPORT_JSON.md` are already complete — they were built incrementally during Step 3. Now generate the analysis report.

**Each command group gets its own report directory.** Never combine multiple command groups into a single report. Each group produces exactly **4 report files** plus a `manifest.json` in its own directory.

When testing "all commands", the final directory structure looks like:

```
CLAUDE-BEHAVIOR-TESTING/
├── channels/
│   ├── REPORT_PRIMARY.md
│   ├── REPORT_HELP.md        ← all --help output (built in Step 3)
│   ├── REPORT_NON_JSON.md    ← functional output, human-readable (built in Step 3)
│   ├── REPORT_JSON.md        ← functional output, --pretty-json (built in Step 3)
│   └── manifest.json         ← execution manifest (built in Step 3)
├── rooms/
│   ├── REPORT_PRIMARY.md
│   ├── REPORT_HELP.md
│   ├── REPORT_NON_JSON.md
│   ├── REPORT_JSON.md
│   └── manifest.json
├── spaces/
│   └── ...
├── logs/
│   └── ...
├── connections/
│   └── ...
├── bench/
│   └── ...
├── accounts/
│   └── ...
├── apps/
│   └── ...
├── auth/
│   └── ...
├── queues/
│   └── ...
├── integrations/
│   └── ...
├── stats/
│   └── ...
├── config/
│   └── ...
├── version/
│   └── ...
└── status/
    └── ...
```

**Do NOT group multiple command groups into one directory** (e.g., do NOT create `control-api/` containing apps + auth + queues). Each command group = one directory = one set of 4 reports + manifest.

**The four report files per command group:**

1. **`REPORT_HELP.md`** — Built incrementally during Step 3. All `--help` output (topic-level and command-level). Help output is mode-independent so it has its own dedicated report, keeping the functional reports focused on actual test output. This is evidence-only — no analysis.
2. **`REPORT_NON_JSON.md`** — Built incrementally during Step 3. Raw output documentation for human-readable mode. Contains ONLY the command and its actual output (stdout, stderr, exit code) for every functional command tested. No help output, no analysis, no pass/fail tables — just commands and what they produced. This is a test execution log / evidence file.
3. **`REPORT_JSON.md`** — Built incrementally during Step 3. Same as above but with `--pretty-json` flag. Raw output only.
4. **`REPORT_PRIMARY.md`** — Generated now in Step 4. Contains ALL analysis: summary, commands tested table, every issue found, cross-mode analysis, help validation summary, and report links. This is the ONLY file with analysis.

### How to Generate REPORT_PRIMARY.md

To generate the analysis, **read the completed per-mode reports** using the Read tool. This ensures the analysis is based on actual captured output, not on context memory that may have been compressed.

1. **Read all three reports** — Use the Read tool on `REPORT_HELP.md`, `REPORT_NON_JSON.md`, and `REPORT_JSON.md`. These are the source of truth — do NOT rely on context memory.

2. **Compare across output modes** — For each command, compare both modes:
   - Are the same data fields present across modes?
   - Does `--pretty-json` produce valid JSON?
   - Is stdout clean in JSON mode (no progress messages leaking)?
   - Does JSON output use correct envelope structure (`type`, `command`, `success`, `<domainKey>`)?

3. **Cross-command validation** — Verify workflows span commands (all MUST produce non-empty output):
   - Data published via `publish` appears in `subscribe` output (subscriber MUST have received messages)
   - Data published via `publish` appears in `history` output (history MUST return records)
   - Presence entered via `enter` appears in `get` output (get MUST return members)
   - Mutations (append, update, delete) operated on real serials from prior publish/send
   - For Control API: resources created via `create` appear in `list` and `get`

4. **Consistency checks** (per `references/testing-dimensions.md`):
   - Same flag behaves identically across commands (`--limit`, `--duration`, `--pretty-json`)
   - Same field formatting across commands (timestamps, IDs, labels)
   - Same error patterns across commands (stderr, exit codes, JSON error envelope)

5. **Document issues** — For any failures or inconsistencies:
   - Exact steps to reproduce
   - Expected vs actual behavior
   - Severity assessment (critical/major/minor/low)
   - Which output modes affected

6. **Write `REPORT_PRIMARY.md`** — Using the analysis from steps 1-5 above, write the primary report. It consolidates: the commands tested table, every issue found (all severities, all modes), cross-mode analysis, and per-mode report links. Each issue entry must specify which output mode(s) it affects. REPORT_PRIMARY.md is the ONLY file that contains analysis — the per-mode reports are evidence-only.

### Primary Report Structure (`REPORT_PRIMARY.md`)

```markdown
# Behavior Test Report — [Command Group]

**Date:** YYYY-MM-DD
**CLI Version:** X.Y.Z
**Account Tier:** Free / Pro
**Execution Mode:** Serial / Parallel
**Tester:** Claude (automated)

## Overall Summary

| Report | Total Entries | Passed | Failed | Skipped |
|--------|-------------|--------|--------|---------|
| Help (--help) | N | N | N | N |
| Human-readable | N | N | N | N |
| JSON (--pretty-json) | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |

## Commands Tested

[List every command tested with pass/fail/skip status and brief notes]

| Command | Help | Human-Readable | JSON | Notes |
|---------|------|---------------|------|-------|
| `channels publish` | PASS | PASS | PASS | |
| `channels subscribe` | PASS | PASS | PASS | Received 3/3 messages |
| `channels history` | PASS | PASS | PASS | |
| ... | ... | ... | ... | ... |

## Help Validation Summary

[Summary of help output review from REPORT_HELP.md:]
- Total help entries tested: N (topic-level: N, command-level: N)
- Missing USAGE sections: [list or "none"]
- Undocumented flags: [list or "none"]
- Stale/inaccurate descriptions: [list or "none"]
- Missing subcommands in topic help: [list or "none"]

## All Issues Found

[Every issue found across all output modes, consolidated here. Each entry includes:]
[- Severity (critical/major/minor/low)]
[- Affected command(s)]
[- Description]
[- Which output mode(s) are affected (help / human-readable / JSON / all)]
[- Steps to reproduce]
[- Expected vs actual behavior]

## Cross-Mode Analysis

[Comparison findings: field parity, JSON envelope correctness, stdout cleanliness]

## Per-Report Links

- [Help Output](REPORT_HELP.md)
- [Human-Readable Output](REPORT_NON_JSON.md)
- [JSON Output](REPORT_JSON.md)
```

### Per-Mode Report Structure (`REPORT_HELP.md`, `REPORT_NON_JSON.md`, and `REPORT_JSON.md`)

These files are built incrementally during Step 3. Each command section is appended immediately after execution, using the Read tool to copy the temp file contents verbatim into the report.

**The process for each section (executed during Step 3):**
1. Execute command → stdout/stderr/exitcode captured to temp files
2. Read `$CMD_DIR/stdout.txt` using the Read tool
3. Read `$CMD_DIR/stderr.txt` using the Read tool
4. Read `$CMD_DIR/exitcode.txt` using the Read tool
5. Append a section to the report file using Edit, copying the Read tool output verbatim

This is deterministic — the report content comes directly from the temp files, not from context memory. The Read tool returns the exact file contents, which are then written into the report.

**Every command entry must include:**
1. The exact command that was run (in a bash code block)
2. The complete stdout output (copied verbatim from the temp file via Read)
3. The complete stderr output (copied verbatim, or "(empty)" if the file was empty)
4. The exit code (from exitcode.txt)

**Section format** (same for every command type):
```markdown
---

### `ably <group> <subcommand>`

**Command:**
\`\`\`bash
[exact command that was run]
\`\`\`

**stdout:**
\`\`\`
[verbatim contents of stdout.txt — copied from Read tool output]
\`\`\`

**stderr:**
\`\`\`
[verbatim contents of stderr.txt — or "(empty)"]
\`\`\`

**Exit Code:** [contents of exitcode.txt]

---
```

See `references/report-template.md` for additional format variations (subscribe workflows, flag variations, error paths).

**Anti-patterns — do NOT do these in per-mode reports:**
- Do NOT use pass/fail tables instead of actual output — analysis belongs in REPORT_PRIMARY.md only
- Do NOT write descriptions like "Found 3 messages with correct data" — copy the actual output from the temp file
- Do NOT skip commands or combine multiple commands into one summary section
- Do NOT abbreviate output with `...` — the Read tool returns full file contents, copy them entirely
- Do NOT include "Review & Analysis" or "Validation" sections
- Do NOT write report sections from memory — always Read the temp file first, then write the section

---

## Step 5: Verify Completeness and Report Integrity

After all tests complete and per-mode reports are fully built, perform these verification steps. This is the quality gate that ensures reports are trustworthy, complete, and deterministic.

### 5a. Manifest-Based Completeness Check

Read `manifest.json` and cross-check against the Step 1 command checklist:

```bash
# Count manifest entries vs checklist items
MANIFEST="CLAUDE-BEHAVIOR-TESTING/<group>/manifest.json"
echo "Total executions: $(jq '.executions | length' "$MANIFEST")"
echo "Report sections written: $(jq '[.executions[] | select(.reportSectionWritten == true)] | length' "$MANIFEST")"
echo "Validation failures: $(jq '[.executions[] | select(.validation.jsonValid == false or .validation.streamClean == false or .validation.truncated == true)] | length' "$MANIFEST")"
echo "Readiness timeouts: $(jq '[.executions[] | select(.validation.readinessTimeout == true)] | length' "$MANIFEST")"
```

Every command in the Step 1 checklist must have a corresponding manifest entry with `reportSectionWritten: true`. If any are missing, go back and test them before proceeding.

### 5b. Report Section Count Verification

Count the actual sections in each report and compare against the manifest:

```bash
HELP_RPT="CLAUDE-BEHAVIOR-TESTING/<group>/REPORT_HELP.md"
NON_JSON="CLAUDE-BEHAVIOR-TESTING/<group>/REPORT_NON_JSON.md"
JSON_RPT="CLAUDE-BEHAVIOR-TESTING/<group>/REPORT_JSON.md"
echo "REPORT_HELP sections: $(grep -c '^### ' "$HELP_RPT")"
echo "REPORT_NON_JSON sections: $(grep -c '^### ' "$NON_JSON")"
echo "REPORT_JSON sections: $(grep -c '^### ' "$JSON_RPT")"
```

The section counts should match the manifest's execution count per report file. A mismatch means a section was either duplicated or dropped. Specifically:
- `REPORT_HELP sections` should equal manifest entries where `mode == "help"`
- `REPORT_NON_JSON sections` should equal manifest entries where `mode == "human-readable"` or `mode == "error"`
- `REPORT_JSON sections` should equal manifest entries where `mode == "json"`

### 5c. Output Integrity Audit

Check for common integrity issues across all captured outputs:

1. **Empty stdout where data was expected** — scan manifest for one-shot data commands (history, list, get) where `files.stdout.bytes` is 0. These indicate prerequisite data was not seeded.
2. **JSON validation failures** — any manifest entries where `validation.jsonValid` is false need investigation. Either the command emitted non-JSON or streams were contaminated.
3. **Truncated outputs** — manifest entries where `validation.truncated` is true need re-reading with offset/limit chunking.
4. **Stream contamination** — entries where `validation.streamClean` is false should be flagged as issues in REPORT_PRIMARY.md.

### 5d. Report Footer

After verification, append an integrity summary footer to each per-mode report:

```markdown
---

## Report Integrity Summary

- **Total sections:** N
- **Generated from manifest:** CLAUDE-BEHAVIOR-TESTING/<group>/manifest.json
- **All outputs sourced from temp files:** Yes
- **JSON validation (--pretty-json only):** N/N passed
- **Stream contamination detected:** Yes/No (N commands affected)
- **Truncated outputs:** None / N commands (re-read with chunking)
- **Readiness timeouts:** None / N workflows
- **Report generated:** YYYY-MM-DD HH:MM:SS UTC
```

This footer serves as a self-audit — anyone reviewing the report can verify its completeness at a glance.

### 5e. Finalize Manifest

Update `manifest.json` with completion metadata:

```json
{
  "completedAt": "<ISO-8601>",
  "totalExecutions": N,
  "integrity": {
    "helpSections": N,
    "nonJsonSections": N,
    "jsonSections": N,
    "jsonValidationPassed": N,
    "streamContaminationCount": N,
    "truncatedOutputs": N,
    "readinessTimeouts": N,
    "missingFromChecklist": []
  }
}
```

### 5f. Clean Up Temp Directory

Remove `CLAUDE-BEHAVIOR-TESTING/<command-group>/temp/` only after all reports and manifest are finalized. The manifest preserves the metadata that was in the temp files, so the raw artifacts are no longer needed.

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
- In human-readable mode: data goes to stdout. Decoration (progress, success, listening, holding, warnings) goes to stderr via logging helpers.
- In `--pretty-json` mode: `logProgress` and `logSuccessMessage` are silent (no-ops). `logListening`, `logHolding`, and `logWarning` emit structured JSON on stdout. All data output is JSON on stdout. Verify: `stdout | jq .` must succeed.
- Errors go to stderr in all modes.

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

## Execution Strategy

Execution mode depends on the account tier selected in the Pre-Flight check.

### Pro Tier — Parallel Execution

Spawn parallel agents — **one agent per command group** — for faster execution:

1. **One agent per command group** — Each command group (e.g., `channels`, `apps`, `auth`) gets its own agent. Do NOT group multiple command groups into a single agent (e.g., do NOT put `apps` + `auth` + `queues` + `integrations` into one "Control API" agent). Each group has its own report directory (`CLAUDE-BEHAVIOR-TESTING/<command-group>/`).
2. **Within each agent** — Test subcommands sequentially where workflows depend on each other (subscribe needs publish first, CRUD needs create first)
3. **Report generation** — Each agent produces its own complete set of 4 reports (`REPORT_PRIMARY.md`, `REPORT_HELP.md`, `REPORT_NON_JSON.md`, `REPORT_JSON.md`) plus `manifest.json` under `CLAUDE-BEHAVIOR-TESTING/<command-group>/`. Each agent runs Steps 3-5 independently for its group — including manifest finalization and integrity verification. The parent conversation does NOT need to re-verify individual groups.
4. **Inter-group dependencies** — If a command group depends on data from another group (e.g., `logs` needs activity from `channels`), either run the dependency first or have the agent generate its own prerequisite data

### Free Tier — Serial Execution

Run command groups one at a time to stay within free-tier rate limits:

1. **One group at a time** — Complete all tests for one command group before starting the next
2. **Compact on threshold** — After finishing a command group's reports, run `/context` to check usage. If context exceeds **45%**, run `/compact` before starting the next group. If under 45%, skip compaction and continue. Compaction is expensive (takes time, loses conversation detail), so only use it when context pressure is real.
3. **Follow phase ordering** — Use the Testing Priority Order from `references/command-inventory.md` to ensure producers run before consumers
4. **Do NOT spawn parallel agents** — All commands execute in the main conversation

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
- History/get/list queries return expected data **with non-empty results**
- JSON output (via `--pretty-json`) is valid and parseable (`jq`-friendly)
- Streaming output (via `--pretty-json`) has one valid JSON object per event
- **Subscribe commands received at least one event/message during testing** (except observe-only — see below)
- **History commands returned at least one record**
- **Get/get-all commands returned at least one item**
- **Mutation commands (append, update, delete) operated on a real serial and returned success**
- **Observe-only subscribe commands** (logs subscribe, logs channel-lifecycle subscribe, logs connection-lifecycle subscribe, logs push subscribe, occupancy subscribe) successfully connected, emitted listening signal, and exited cleanly after `--duration`

A command **fails** if:
- Output is missing fields compared to documentation
- JSON output has incorrect envelope structure
- Human-readable text (progress, listening) leaks into stdout in `--pretty-json` mode
- Error messages are unclear or missing
- Commands crash, hang, or exit with wrong code
- Data published is not received by subscriber
- Pagination produces incorrect results
- Exit code doesn't match success/failure state
- **Subscribe command produced empty output (no events received) — prerequisites were not set up** (does NOT apply to observe-only subscribe commands — see Section C exception)
- **History command returned zero records — data was not seeded before querying**
- **Get/get-all/list command returned empty results when data should exist — prerequisites were not run**
- **Annotations get/subscribe returned empty when annotations were expected to exist**

---

## Completion Checklist

**Before declaring testing complete**, cross-check the scope selected in Step 0 against the reports generated. Every command group in scope MUST have its own report directory under `CLAUDE-BEHAVIOR-TESTING/`.

**If "All commands" (option 17) was selected**, verify each of these has a report directory:

| # | Command Group | Report Directory | Notes |
|---|--------------|-----------------|-------|
| 1 | `channels` | `CLAUDE-BEHAVIOR-TESTING/channels/` | |
| 2 | `rooms` | `CLAUDE-BEHAVIOR-TESTING/rooms/` | |
| 3 | `spaces` | `CLAUDE-BEHAVIOR-TESTING/spaces/` | |
| 4 | `logs` | `CLAUDE-BEHAVIOR-TESTING/logs/` | |
| 5 | `connections` | `CLAUDE-BEHAVIOR-TESTING/connections/` | |
| 6 | `bench` | `CLAUDE-BEHAVIOR-TESTING/bench/` | |
| 7 | `accounts` | `CLAUDE-BEHAVIOR-TESTING/accounts/` | Skip `login`/`logout` (interactive, affects session) |
| 8 | `apps` | `CLAUDE-BEHAVIOR-TESTING/apps/` | |
| 9 | `auth` | `CLAUDE-BEHAVIOR-TESTING/auth/` | |
| 10 | `queues` | `CLAUDE-BEHAVIOR-TESTING/queues/` | |
| 11 | `integrations` | `CLAUDE-BEHAVIOR-TESTING/integrations/` | |
| 12 | `push` | Skipped unless explicitly requested | |
| 13 | `stats` | `CLAUDE-BEHAVIOR-TESTING/stats/` | |
| 14 | `config` | `CLAUDE-BEHAVIOR-TESTING/config/` | show, path |
| 15 | `version` | `CLAUDE-BEHAVIOR-TESTING/version/` | standalone |
| 16 | `status` | `CLAUDE-BEHAVIOR-TESTING/status/` | standalone |

**If any group in scope is missing a report directory, it was missed.** Go back and test it before reporting completion.

Present this checklist to the user at the end so they can verify coverage.
