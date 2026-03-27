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

| State | Expected Output | Stream | Flags Affected |
|-------|----------------|--------|----------------|
| CONNECTING | Progress message: "Attaching to channel..." | stderr | `--verbose` shows details |
| CONNECTED | (implicit, no separate message) | — | |
| SUBSCRIBED | "Listening for messages." / "Press Ctrl+C to exit." | stderr | Suppressed in `--pretty-json` |
| RECEIVING | Formatted message output | stdout | `--pretty-json` changes format |
| CLEANUP | (silent) | — | `--verbose` may show cleanup |
| EXIT | Clean exit, code 0 | — | |

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
| Single message event | `message` | `{ "type": "event", "message": { ... } }` |
| Message history | `messages` | `{ "type": "result", "messages": [ ... ] }` |
| Presence event | `presence` | `{ "type": "event", "presence": { ... } }` |
| Presence get | `members` | `{ "type": "result", "members": [ ... ] }` |
| Channel list | `channels` | `{ "type": "result", "channels": [ ... ] }` |
| Room list | `rooms` | `{ "type": "result", "rooms": [ ... ] }` |
| Occupancy | `occupancy` | `{ "type": "result", "occupancy": { ... } }` |
| Lock event | `lock` | `{ "type": "event", "lock": { ... } }` |
| Cursor event | `cursor` | `{ "type": "event", "cursor": { ... } }` |
| Space members | `members` | `{ "type": "result", "members": [ ... ] }` |

---

## 4. Stream Separation Testing

This is a critical CLI testing dimension. All CLI tools must properly separate data from metadata.

### Rules
- **stdout**: Data output only — human-readable records OR JSON payloads
- **stderr**: Progress messages, warnings, verbose output, error messages

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

### Common Violations to Check
- Progress messages ("Attaching to channel...") appearing on stdout in JSON mode
- "Listening for messages." appearing on stdout in JSON mode
- Warning messages on stdout instead of stderr
- Error messages on stdout instead of stderr
- ANSI color codes in piped/non-TTY output

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
