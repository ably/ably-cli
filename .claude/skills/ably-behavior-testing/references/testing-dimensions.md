# Behavior Testing Dimensions

This reference covers the specific testing dimensions that go beyond basic functional testing. These are derived from established CLI behavior testing best practices.

---

## 1. Code Path Coverage

Behavior testing means exercising all observable code paths through their external behavior. For each command, identify and test:

### Conditional Branches in Flag Handling
- Commands with `--pretty-json`: verify human-readable output is suppressed on stdout
- Commands with `--verbose`: verify additional debug information appears on stderr
- Commands with optional flags: test with and without each optional flag
- Commands with mutually dependent flags: test combinations

### Transport Path Selection
Some commands (e.g., `channels publish`) auto-select between REST and Realtime based on flags:
- Single publish: REST transport
- Publish with `--count > 1`: Realtime transport
- Subscribe commands: always Realtime

### Encryption Paths
`--cipher-key` is available on `channels subscribe` and `channels history`:
- Without `--cipher-key`: standard message format
- With `--cipher-key`: messages are decrypted using the provided hex-encoded key
- Test: publish encrypted messages, then verify `subscribe --cipher-key` and `history --cipher-key` both decrypt correctly

### Batch vs Single Operations
- `channels publish` with single message vs `channels batch-publish`
- `channels publish` with `--count 1` vs `--count 5`
- Verify progress indicators for batch operations

---

## 2. State Machine Validation

Long-running commands follow a state machine. Test each state transition:

```
INIT
  |
  v
CONNECTING ──(error)──> ERROR ──> EXIT
  |
  v
CONNECTED
  |
  v
SUBSCRIBED ──(disconnect)──> RECONNECTING ──> CONNECTED
  |
  v
RECEIVING
  |
  v (duration expires or SIGINT)
CLEANUP
  |
  v
EXIT
```

### What to Verify at Each State

| State | Expected Output | Stream | JSON Mode Behavior |
|-------|----------------|--------|--------------------|
| CONNECTING | Progress message: "Attaching to channel..." | stderr | Silent (no-op via `logProgress`) |
| CONNECTED | (implicit, no separate message) | — | — |
| SUBSCRIBED | "Listening for messages. Press Ctrl+C to exit." | stderr | Emits `{"type":"status","status":"listening"}` on **stdout** via `logListening` |
| RECEIVING | Formatted message output | stdout | JSON event objects on stdout |
| CLEANUP | (silent) | — | `--verbose` may show cleanup on stderr |
| EXIT | Clean exit, code 0 | — | Emits `{"type":"status","status":"completed"}` on stdout |

### Hold Commands (enter, set, acquire)
- ENTER: Operation completes, state is held
- HOLD: Status message emitted (especially JSON: `logJsonStatus("holding", ...)`)
- EXIT: Leave/release/cleanup triggered, state removed
- Verify: hold status appears in JSON mode (`type: "status"`)

---

## 3. Output Contract Verification

### JSON Envelope Structure
Every JSON output must follow this contract:

```json
{
  "type": "result" | "event" | "status" | "error",
  "command": "channels.subscribe",
  "success": true,
  "<domainKey>": { ... }
}
```

### Verification Checklist

**One-shot commands** (publish, get, history, list):
- [ ] `type` is `"result"`
- [ ] `command` matches the actual command
- [ ] `success` is `true` for success, absent for events
- [ ] Domain data nested under singular key (single item) or plural key (collection)
- [ ] No raw data fields spread at envelope level
- [ ] `total` / `hasMore` metadata alongside domain key (not inside it)

**Streaming commands** (subscribe):
- [ ] Output is valid JSON — verify with `jq . "$TEMP_DIR/stdout.txt"` (with `--pretty-json`, events are multi-line indented JSON, not single-line NDJSON)
- [ ] `type` is `"event"` for data events
- [ ] Domain data nested under singular key (e.g., `"message"`)
- [ ] Timestamps are present and in correct format

**Hold commands** (enter, set, acquire):
- [ ] Initial result with `type: "result"`
- [ ] Followed by `type: "status"` with `"holding"` message
- [ ] Both are valid JSON lines

**Error responses** (with `--pretty-json`):
- [ ] `type` is `"error"`
- [ ] `success` is `false`
- [ ] Error details include code and message
- [ ] No human-readable text mixed into stdout
- [ ] stderr may still contain human-readable error

### Domain Key Naming

| Command Type | Key | Example |
|-------------|-----|---------|
| Channel message event | `message` | `{ "type": "event", "message": { ... } }` |
| Channel message history | `messages` | `{ "type": "result", "messages": [ ... ] }` |
| Channel publish result | `message` | `{ "type": "result", "message": { ... } }` |
| Room message event | `message` | `{ "type": "event", "message": { ... } }` |
| Room message history | `messages` | `{ "type": "result", "messages": [ ... ] }` |
| Presence event | `presence` | `{ "type": "event", "presence": { ... } }` |
| Presence get | `members` | `{ "type": "result", "members": [ ... ] }` |
| Channel list | `channels` | `{ "type": "result", "channels": [ ... ] }` |
| Room list | `rooms` | `{ "type": "result", "rooms": [ ... ] }` |
| Occupancy result/event | `occupancy` | `{ "type": "result", "occupancy": { ... } }` |
| Annotation event | `annotation` | `{ "type": "event", "annotation": { ... } }` |
| Annotation get | `annotations` | `{ "type": "result", "annotations": [ ... ] }` |
| Lock event | `lock` | `{ "type": "event", "lock": { ... } }` |
| Lock get | `locks` | `{ "type": "result", "locks": [ ... ] }` |
| Cursor event | `cursor` | `{ "type": "event", "cursor": { ... } }` |
| Cursor get | `cursors` | `{ "type": "result", "cursors": [ ... ] }` |
| Space member event | `member` | `{ "type": "event", "member": { ... } }` |
| Space members get | `members` | `{ "type": "result", "members": [ ... ] }` |
| Location event | `location` | `{ "type": "event", "location": { ... } }` |
| Location get | `locations` | `{ "type": "result", "locations": [ ... ] }` |
| Typing event | `typing` | `{ "type": "event", "typing": { ... } }` |
| Reaction event (room) | `reaction` | `{ "type": "event", "reaction": { ... } }` |
| Message reaction event | `reaction` | `{ "type": "event", "reaction": { ... } }` |
| Spaces list | `spaces` | `{ "type": "result", "spaces": [ ... ] }` |

> **Note**: These domain key names are the expected convention — verify against actual CLI output. If a command uses a different key, report it as an inconsistency.

---

## 4. Stream Separation Testing

This is a critical CLI testing dimension. All CLI tools must properly separate data from metadata.

### Rules
- **stdout**: Data output only — human-readable records OR JSON payloads
- **stderr**: Progress messages (`logProgress`), success messages (`logSuccessMessage`), listening/holding signals (`logListening`, `logHolding`), warnings (`logWarning`), verbose output, error messages
- **JSON mode exception**: `logListening`, `logHolding`, and `logWarning` emit structured JSON on **stdout** (not stderr) in JSON mode. `logProgress` and `logSuccessMessage` are silent (no-ops) in JSON mode.

### How to Test

All temp files go under `CLAUDE-BEHAVIOR-TESTING/<command-group>/temp/` (see SKILL.md Step 3).

```bash
# Capture streams separately
pnpm cli channels list --pretty-json >"$TEMP_DIR/stdout.txt" 2>"$TEMP_DIR/stderr.txt"

# Verify stdout is pure JSON
jq . "$TEMP_DIR/stdout.txt" >/dev/null 2>&1
echo "JSON valid: $?"

# Verify stderr has progress (if any)
cat "$TEMP_DIR/stderr.txt"

# For streaming commands
pnpm cli channels subscribe test-ch --pretty-json --duration 5 >"$TEMP_DIR/stdout.txt" 2>"$TEMP_DIR/stderr.txt"
# Verify JSON validity
jq . "$TEMP_DIR/stdout.txt" >/dev/null 2>&1 && echo "Valid JSON" || echo "INVALID JSON"
```

### Automated Contamination Detection

After every `--pretty-json` capture, the post-capture validation step (SKILL.md Step B) automatically checks for stream contamination. This catches issues that visual inspection would miss:

```bash
# Detect human-readable text that leaked into JSON stdout
grep -qiE '(Attaching to|Listening for|Press Ctrl|Published|✓|⚠|✗)' "$D/stdout.txt"
# If this matches, stream_clean=false — the CLI has a bug

# Detect invalid JSON lines mixed with valid ones
# Each line of stdout in JSON mode should parse as JSON (for NDJSON)
# or the entire file should parse as one JSON document (for --pretty-json)
jq . "$D/stdout.txt" >/dev/null 2>&1
```

Record `stream_clean` and `json_valid` in the manifest. Both `false` values are flagged as issues in REPORT_PRIMARY.md.

### Common Violations to Check
- Progress messages ("Attaching to channel...") appearing on stdout in any mode (should be stderr)
- "Listening for messages." text appearing on stdout in human-readable mode (should be stderr via `logListening`)
- In JSON mode: non-JSON progress text leaking to stdout (only structured JSON status events are allowed)
- Warning messages on stdout instead of stderr in human-readable mode
- Error messages on stdout instead of stderr
- ANSI color codes in piped/non-TTY output
- **Mixed encoding**: non-UTF-8 bytes in stdout breaking JSON parsers
- **Partial JSON**: command interrupted mid-write leaving an incomplete JSON object as the last line

---

## 5. Configuration Resolution Testing

Test the auth/config precedence chain:

```
CLI flags (highest priority)
  |
Environment variables (ABLY_API_KEY, ABLY_TOKEN, ABLY_ACCESS_TOKEN)
  |
Stored config (ably login)
  |
Defaults (lowest priority)
```

### Test Scenarios
- Command with stored config (default): should work
- Command with `--app` flag: should override default app
- Command with invalid app: should produce clear error

---

## 6. Pagination Testing

For commands that return paginated results (history, list):

### Scenarios

| Scenario | How to Test | Verify |
|----------|------------|--------|
| Default limit | Run without `--limit` | Returns default number of items |
| Custom limit | `--limit 5` | Returns exactly 5 (or fewer if less exist) |
| Limit 1 | `--limit 1` | Returns exactly 1 item |
| Large limit | `--limit 1000` | Returns available items, no crash |
| Direction | `--direction forwards` vs `backwards` | Order changes |
| Time range | `--start "1h" --end "now"` | Only items in range |
| hasMore indicator | Check JSON output | `hasMore: true` when more pages exist |
| Pagination hint | Check JSON output | `hint` field when `hasMore` is true |

### Pagination Log
When in non-JSON mode, verify:
- "Fetched N pages" message appears when multiple pages consumed
- Billable warning for history commands

---

## 7. Human-Readable vs JSON Field Parity

For every command, compare the fields shown in human-readable output vs JSON output:

### Rules
- JSON output should contain **all** fields from human-readable output
- JSON output may contain **additional** fields not shown in human-readable output
- Human-readable output should **never** contain fields absent from JSON output
- Null/undefined fields should be **omitted** in both modes (not shown as "null")

### Common Field Mismatches to Check
- Timestamps: human-readable may format differently (ISO string vs Unix ms)
- IDs: may be truncated in human-readable but full in JSON
- Metadata: may be flattened in human-readable but nested in JSON
- Empty arrays: should be omitted in human-readable, present as `[]` in JSON

---

## 8. Error Path Testing Matrix

| Error Category | Test Method | Expected Behavior |
|---------------|-------------|-------------------|
| Missing required arg | Omit channel/room name | Clear error on stderr, non-zero exit code |
| Invalid flag value | `--limit -1` or `--limit abc` | Validation error with guidance |
| Unknown flag | `--nonexistent-flag` | "Unknown flag" error, possibly with suggestion |
| Auth failure | (if testable) Invalid API key | "Authentication failed" with hint |
| Network error | (if reproducible) Invalid host | Connection error with retry guidance |
| Not found | Nonexistent channel in history | Empty result or appropriate message |
| Permission denied | (if testable) Restricted key | Permission error with hint |
| JSON error envelope | Any error with `--pretty-json` | `type: "error"`, `success: false`, on stdout |

---

## 9. Exit Code Testing

Every command must be tested for correct exit codes:

| Scenario | Expected Exit Code |
|----------|-------------------|
| Successful operation | 0 |
| Missing required argument | Non-zero (typically 2) |
| Unknown flag | Non-zero (typically 2) |
| Auth failure | Non-zero |
| Resource not found | Non-zero |
| Clean exit after `--duration` | 0 |
| Network error | Non-zero |

### How to Test
```bash
pnpm cli channels list --pretty-json >/dev/null 2>&1; echo "Exit: $?"
pnpm cli channels publish 2>&1; echo "Exit: $?"  # missing args
pnpm cli channels list --bogus-flag 2>&1; echo "Exit: $?"
```

---

## 10. Signal and Lifecycle Testing

### Duration Flag
- `--duration 5`: command exits after ~5 seconds
- `--duration 0.5`: command exits quickly (useful for testing)
- No `--duration`: command runs until interrupted

### Clean Shutdown
When a long-running command exits (via duration or interrupt):
- No error messages on clean exit
- Exit code is 0
- Resources cleaned up (no leaked connections in verbose output)
- Presence left (if entered)
- Any held state released

---

## 11. Cross-Command Consistency

Verify consistent behavior patterns across similar commands:

### Naming Consistency
- Channels use "publish" / Rooms use "send"
- Both use "subscribe" for listening
- Both use "history" for past events
- Both use "presence" subgroup
- Spaces use "enter"/"set"/"acquire" for hold commands

### Output Format Consistency
- Same field formatting (timestamps, IDs, labels) across all commands
- Same progress message patterns ("Attaching to...", "Listening for...")
- Same error message patterns
- Same JSON envelope structure

### Flag Consistency
- `--limit` behaves the same across history, list commands
- `--duration` behaves the same across all subscribe commands
- `--pretty-json` produces correct envelope structure everywhere
- `--verbose` produces same level of detail everywhere
- `--client-id` is available on all subscribe/presence/publish commands

---

## 12. Control API Testing Patterns

Control API commands have different testing patterns from Product API commands:

### CRUD Workflow Testing
For resource-managing commands (apps, keys, queues, integrations, rules):

```
CREATE → verify in LIST → GET details → UPDATE → verify change in GET → DELETE → verify gone from LIST
```

### What to Verify
- Create returns the created resource with all fields
- List includes the created resource
- Get returns full details matching create response
- Update changes only specified fields
- Delete removes the resource (may require `--force`)
- Proper error when operating on non-existent resource

### Destructive Operation Safety
- Delete commands should require `--force` or prompt for confirmation
- Error message when `--force` not provided should explain how to proceed
- `--force` skips confirmation and deletes immediately

### Mandatory Cleanup
Every Control API test that creates resources (apps, rules, keys, queues, integrations) **must delete them after testing**. See SKILL.md "Control API Cleanup (MANDATORY)" for the full cleanup table and pattern. Leftover test resources pollute the account and can cause subsequent test runs to fail or produce misleading results.

### Auth Differences
- Control API uses `ABLY_ACCESS_TOKEN` (not `ABLY_API_KEY`)
- Missing token produces different error than missing API key
- Some commands require account-level access, others app-level

---

## 13. Idempotency Testing

For one-shot commands, verify that running the same command twice produces consistent results:

- `list` commands return same data on repeated calls
- `get` commands return same data on repeated calls
- `history` commands return same data (assuming no new messages)
- `publish`/`send` commands each create a new message (not idempotent — this is correct)
- Error conditions produce consistent error messages

---

## 14. Output Capture Integrity

This dimension ensures the testing infrastructure itself is trustworthy — that captured outputs accurately represent what the CLI produced, without corruption, truncation, or interleaving.

### Capture Chain Verification

The output capture chain has four links, and each must be verified:

```
CLI command → shell redirect (>stdout.txt 2>stderr.txt) → temp file on disk → Read tool → report section
```

| Link | What Can Go Wrong | How to Detect |
|------|------------------|---------------|
| CLI → redirect | Command fails to start (pnpm not found, permission denied) | `exitcode.txt` missing or contains unexpected value; `stdout.txt` and `stderr.txt` both empty |
| Redirect → temp file | Disk full, path too long, redirect syntax error | Post-capture validation: `wc -c` returns 0 when output was expected |
| Temp file → Read tool | File exceeds 2000-line default limit; Read silently truncates | Compare `wc -l` from post-capture validation with actual lines returned by Read tool |
| Read tool → report | Copy error, paraphrasing instead of verbatim, context compression | Report Integrity Summary section count vs manifest count |

### Stream Isolation Guarantees

Each file descriptor is redirected to exactly one file. The shell's `>` and `2>` operators ensure physical separation at the OS level — stdout (fd 1) and stderr (fd 2) go to different files and cannot interleave within a single command.

**Where interleaving CAN happen** (and how to prevent it):
- **Multiple commands in one Bash call** — each command must redirect to different files (e.g., `sub_stdout.txt`, `pub1_stdout.txt`). Never redirect two commands to the same file.
- **Background processes writing concurrently** — safe because each process writes to its own file. The OS handles concurrent writes to different files correctly.
- **Shell builtins mixed with command output** — `echo $?` must use `;` chaining and write to `exitcode.txt`, never appending to `stdout.txt`.

### Truncation Detection and Recovery

The Read tool defaults to 2000 lines. Commands with verbose output (e.g., `channels list` with many channels, `--pretty-json` with deeply nested objects) may exceed this:

1. **Detection**: Post-capture validation records `stdout_lines`. If ≥1800, flag as potential truncation risk.
2. **Recovery**: Use `offset` and `limit` parameters on the Read tool to read in 1500-line chunks. Concatenate all chunks in the report section.
3. **Verification**: After writing the report section, the line count in the section should match `stdout_lines` from validation.

### JSON Output Integrity

For `--pretty-json` captures, JSON validity is a hard requirement. Invalid JSON means one of:
- **Stream contamination**: human-readable progress text leaked to stdout (a CLI bug)
- **Partial output**: command was interrupted before completing its JSON output
- **Encoding issue**: non-UTF-8 characters in message data

The post-capture validation step runs `jq .` on stdout and records `json_valid: true|false`. Failures are automatically flagged for investigation and inclusion in REPORT_PRIMARY.md.

### Deterministic Report Ordering

Reports must produce the same section ordering across runs. The ordering rule is:
1. Topic-level help (e.g., `channels --help`)
2. Commands in checklist order (from Step 1)
3. For each command: help → human-readable execution → flag variations → error paths
4. Within REPORT_JSON.md: same command order as REPORT_NON_JSON.md (minus help-only entries)

The manifest's execution order is the canonical sequence. If agents run in parallel, the report assembly step must sort sections by the manifest's ordering, not by agent completion order.

---

## 15. Output Completeness Testing (Non-Empty Output Verification)

This is a **critical** testing dimension. The purpose of behavior testing is to verify the CLI correctly displays real data — not just that it connects without errors. A command that connects successfully but returns empty output has NOT been adequately tested.

### The Problem

Many commands depend on data that must exist before the command is run. Without proper setup:
- `subscribe` connects but receives zero messages → empty stdout, looks like a "pass" but is worthless
- `history` succeeds with exit code 0 but returns "No messages found" → no data formatting was verified
- `get` returns empty results → no field display was tested
- `annotations get` returns no annotations → annotation rendering was never tested

### The Rule

**Every command that reads, queries, or subscribes to data MUST produce non-empty output during testing.** Empty output from a data-consuming command is a test failure, not a pass.

### Command Categories and Their Prerequisites

| Command Type | Example Commands | Must Have Before Running |
|-------------|-----------------|-------------------------|
| **Subscribe** | `channels subscribe`, `annotations subscribe`, `presence subscribe`, `rooms messages subscribe`, `rooms reactions subscribe`, `rooms typing subscribe`, `spaces members subscribe`, `spaces locations subscribe`, `spaces locks subscribe`, `spaces cursors subscribe`, `spaces occupancy subscribe`, `rooms occupancy subscribe` | Producer running concurrently (publish, enter, set, keystroke, etc.) |
| **History** | `channels history`, `rooms messages history`, `logs history`, `logs connection-lifecycle history`, `logs push history` | Data published/sent before querying |
| **Get/Get-all** | `channels presence get`, `rooms presence get`, `spaces members get`, `spaces locations get`, `spaces locks get`, `spaces cursors get`, `channels occupancy get`, `rooms occupancy get`, `spaces occupancy get`, `channels annotations get` | Relevant state set up (presence entered, location set, lock acquired, cursor set, annotations published) |
| **List** | `channels list`, `rooms list`, `spaces list` | At least one resource active (channel attached, room with messages, space with members) |
| **Mutations** | `channels append`, `channels update`, `channels delete`, `rooms messages update`, `rooms messages delete`, `channels annotations delete`, `rooms messages reactions send`, `rooms messages reactions remove` | A real serial from a prior publish/send |
| **CRUD** | `apps rules list`, `queues list`, `integrations list`, `auth keys list`, `push channels list`, `push devices list` | Resource created via corresponding `create`/`save` command |

### How to Verify Non-Empty Output

```bash
# For one-shot commands: check stdout is not empty/trivial
OUTPUT=$(pnpm cli channels history test-ch --limit 10 2>/dev/null)
if [ -z "$OUTPUT" ] || echo "$OUTPUT" | grep -q "No messages"; then
  echo "FAIL: History returned empty — data was not seeded"
fi

# For JSON commands: check the data array/object is not empty
pnpm cli channels history test-ch --limit 10 --pretty-json 2>/dev/null | jq '.messages | length'
# Should output > 0

# For subscribe commands: check captured stdout has at least one data line
if [ ! -s "$TEMP_DIR/sub_stdout.txt" ]; then
  echo "FAIL: Subscriber received no events — publisher was not run"
fi
```

### Common Pitfalls

1. **Testing subscribe without concurrent publish** — The subscriber connects, waits for duration, exits with code 0. Output is empty. This tells you nothing about whether the CLI correctly formats received messages.

2. **Testing history before publishing** — History returns empty or "No messages found" with exit code 0. You never verified timestamp formatting, field display, pagination, or JSON envelope structure.

3. **Testing annotations get/subscribe without publishing annotations first** — Annotations are not auto-generated. You must publish a message, get its serial, then publish annotations before get/subscribe will return anything.

4. **Testing presence get without anyone entered** — Returns empty members list. You never verified member data formatting, client-id display, or JSON field structure.

5. **Testing spaces get-all commands without setting up state** — `spaces locations get`, `spaces locks get`, `spaces cursors get` all require the corresponding `set`/`acquire` to be running in the background.

6. **Testing mutations without a real serial** — `channels append`, `channels update`, `channels delete`, `rooms messages update`, `rooms messages delete` all require a serial from a prior publish/send. Testing with a fake serial only tests error handling, not the actual mutation workflow.
