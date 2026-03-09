# Implementation Plan: Consistent Message Output for channels subscribe & history

## Implementation Status: ✅ COMPLETE (2026-03-09)

All steps have been implemented and verified:
- `pnpm prepare` — ✅ builds successfully
- `pnpm exec eslint .` — ✅ 0 errors in changed files
- `pnpm test:unit` — ✅ 122/122 test files pass (1115 tests passed, 6 pre-existing skips)

### Files changed

| File | Status | What was done |
|------|--------|---------------|
| `src/utils/output.ts` | ✅ Done | Added `MessageDisplayFields` interface (timestamp is `number` — raw ms), `formatMessagesOutput()`, `toMessageJson()`. Imports `isJsonData`/`formatMessageData` from `json-formatter.ts`. |
| `src/commands/channels/subscribe.ts` | ✅ Done | Uses `formatMessagesOutput([msgFields])` + `toMessageJson(msgFields)`. Passes `message.timestamp` as raw number (no `formatMessageTimestamp` conversion). Added `serial` field. Removed `connectionId`/`encoding` from user-facing JSON. Sequence numbers added separately to JSON. |
| `src/commands/channels/history.ts` | ✅ Done | Uses `formatMessagesOutput(displayMessages)` + `displayMessages.map((msg) => toMessageJson(msg))`. Passes `message.timestamp` as raw number. Plain array JSON output. Added `channel`/`serial`/`indexPrefix`. Preserved `limitWarning`. Kept current error handling. |
| `.claude/CLAUDE.md` | ✅ Done | Added "Message display" conventions subsection with raw ms timestamp convention. Updated "History output" bullet to note `channels history` exception. |
| `test/unit/commands/channels/subscribe.test.ts` | ✅ No changes needed | Tests already expected the new format (survived merge). |
| `test/unit/commands/channels/history.test.ts` | ✅ No changes needed | Tests already expected the new format (survived merge). |

### Lint fixes applied
- `output.ts`: Fixed prettier formatting for ternary expression, combined consecutive `Array#push()` calls per `unicorn/no-array-push-push`, fixed prettier formatting for function parameter
- `history.ts`: Wrapped `toMessageJson` in arrow function per `unicorn/no-array-callback-reference`

### Deep cross-check findings (plan vs codebase vs CLAUDE.md)

These are additional issues found during a thorough review that the original plan doesn't fully address:

#### 1. CLAUDE.md "History output" convention divergence

**CLAUDE.md line 191** currently says:
> Use `[index] timestamp` ordering: `` `${chalk.dim(`[${index + 1}]`)} ${formatTimestamp(timestamp)}` ``. Consistent across all history commands (channels, logs, connection-lifecycle, push).

The plan changes `channels history` to put `[index]` on its own line and `Timestamp:` as a labeled field — **intentionally diverging** from the other history commands (`logs history`, `logs push history`, `logs connection-lifecycle history`) which still use the old `[index] [timestamp]` single-line format.

**Action needed**: The CLAUDE.md update (Step 5) must clarify that `channels history` now uses the new `formatMessagesOutput` convention while other history commands retain the old `[index] [timestamp]` pattern. The existing "History output" bullet should be updated to note this exception.

#### 2. `formatTimestamp()` returns `[timestamp]` with brackets — plan uses bare timestamp

The existing `formatTimestamp()` in `src/utils/output.ts` returns `chalk.dim(`[${ts}]`)` — dim text **with square brackets**. The plan's target format shows `Timestamp: 2026-03-06T05:13:09.160Z` (no brackets, no dim on the value).

**Action needed**: `formatMessagesOutput()` must NOT use `formatTimestamp()` for the timestamp value. It should display the raw ISO string directly. The plan's pseudocode (line 285) is correct: `${chalk.dim("Timestamp:")} ${timestamp}`. Step 3 correctly says to remove the `formatTimestamp` import from subscribe.

#### 3. `history.ts` error handling — `handleCommandError` would break error test

The current `history.ts` (lines 127-134) uses a manual try/catch with `this.jsonError()` + `this.error()`. Per CLAUDE.md convention, it should use `this.handleCommandError()`. However, the current code prefixes the error with `"Error retrieving channel history: "`, and the test at line 233 of `history.test.ts` asserts `error?.message` contains `"Error retrieving channel history"`.

If we switch to `this.handleCommandError()`, it would pass the raw error message (e.g., `"API error"`) without the prefix, **breaking the test**.

**Decision**: Keep the current error handling pattern for now (don't switch to `handleCommandError`). This is a minor inconsistency with CLAUDE.md convention but avoids an unnecessary test change. The error handling improvement can be done in a separate PR if desired.

#### 4. `history.ts` `limitWarning` — must be preserved

The current code shows a limit warning at the end (`limitWarning(messages.length, flags.limit, "messages")`). The plan's Step 4 doesn't explicitly mention keeping it.

**Action needed**: Step 4 must preserve the `limitWarning` call after `formatMessagesOutput`. Add it after the `this.log(formatMessagesOutput(...))` call.

#### 5. `formatMessagesOutput` needs `isJsonData` for data display

The plan says data should be inline for simple values and on a new line for JSON objects/arrays. The existing `formatMessageData()` from `src/utils/json-formatter.ts` handles colorized formatting but doesn't distinguish inline vs block. The `isJsonData()` function from the same file can be used to decide.

**Action needed**: `formatMessagesOutput` should use `isJsonData(data)` to decide:
- Simple data: `${chalk.dim("Data:")} ${String(data)}` (inline)
- JSON data: `${chalk.dim("Data:")}\n${formatMessageData(data)}` (block)

Import both `isJsonData` and `formatMessageData` from `src/utils/json-formatter.ts` into `src/utils/output.ts`.

#### 6. Test coverage gaps (non-blocking)

- **Subscribe test**: No assertion for `"Serial:"` — acceptable since mock doesn't include `serial` and the field is optional (omitted when undefined).
- **Subscribe JSON test**: Only checks `error` is undefined and `stdout` is defined — doesn't verify JSON structure. Could be improved but not blocking.
- **History test**: Mock data doesn't include `serial` — acceptable for same reason.

#### 7. E2E compatibility — verified safe

- `channel-subscribe-e2e.test.ts` uses `readySignal = "Subscribed to channel"` — the subscribe command still outputs `success("Subscribed to channel: ...")` which contains this string. ✅ Safe.
- `channel-occupancy-e2e.test.ts` also uses `readySignal: "Subscribed to channel"` — same reasoning. ✅ Safe.
- Data check uses `output.includes("Subscribe E2E Test")` — the message data will still appear in the new format. ✅ Safe.

#### 8. `serial` field confirmed in Ably SDK types

The Ably SDK `Message` interface has `serial?: string` (optional). For realtime `InboundMessage`, `serial: string` (required). Both subscribe (realtime) and history (REST) messages will have this field available.

#### 9. `logCliEvent` in subscribe — keep full message details

The current subscribe code (line 212-218) passes a `messageEvent` object to `logCliEvent` that includes `connectionId`, `encoding`, and `sequence`. This is internal verbose logging, not user-facing output. The `logCliEvent` call should continue to pass the full message details for debugging purposes. Only the user-facing output (human-readable and `--json`) should use the new `formatMessagesOutput`/`toMessageJson` helpers.

**Action needed**: When updating subscribe.ts, keep the `logCliEvent` call with its current `messageEvent` object (or update it to include `serial` too). The `logCliEvent` data is separate from the user-facing output.

#### 10. `sequence` field in subscribe JSON output

The current code adds `sequence: this.sequenceCounter` to the JSON output when `--sequence-numbers` is used. The plan's `toMessageJson` doesn't include `sequence`. Since `sequence` is subscribe-specific (not part of the shared `MessageDisplayFields`), it should be added to the JSON output separately in subscribe.ts after calling `toMessageJson`:

```typescript
const jsonMsg = toMessageJson(msgFields);
if (flags["sequence-numbers"]) {
  jsonMsg.sequence = this.sequenceCounter;
}
this.log(this.formatJsonOutput(jsonMsg, flags));
```

**Action needed**: Step 3 should note that `sequence` is added to JSON output separately, not via `toMessageJson`.

### Implementation order (updated)

To fix all 4 test failures, implement these steps:

1. **Step 1**: Add `MessageDisplayFields`, `formatMessagesOutput()`, `toMessageJson()` to `src/utils/output.ts`
   - Import `isJsonData`, `formatMessageData` from `json-formatter.ts`
   - Do NOT use `formatTimestamp()` — display raw ISO string
2. **Step 2**: Update `src/commands/channels/subscribe.ts` to use the new helpers
   - Remove `formatTimestamp` import (no longer needed)
   - Add `serial` from `message.serial`
3. **Step 3**: Update `src/commands/channels/history.ts` to use the new helpers
   - Preserve `limitWarning` after `formatMessagesOutput`
   - Keep current error handling (don't switch to `handleCommandError` — would break error test)
4. **Step 5** (recommended): Update `.claude/CLAUDE.md` with message display conventions
   - Note the divergence from the old `[index] timestamp` pattern for `channels history`

Step 6 (tests) is already done — the tests are correct and just need the source to match.

---

## Original Request

Currently when running `bin/run.js channels subscribe test`, the output is:
```
Using: Account=Free account (DIBHRw) • App=Sandbox (jy3uew) • Key=Root (jy3uew.oZJBOA)

Attaching to channel: test...
Successfully attached to channel: test
✓ Subscribed to channel: test.
Listening for messages. Press Ctrl+C to exit.
[2026-03-06T05:13:09.160Z] Channel: test | Event: (none)
Data: hello
```

Fields shown are `Channel`, `Event`, and `Data`.

When running `bin/run.js channels history test`, the output is:
```
[1] 2026-03-06T05:19:36.130Z
Event: (none)
Client ID: ably-cli-d6d6be45
Data:
hello
```

The output is inconsistent between subscribe and history. We want to show exactly the same fields with the same format for both commands. The important fields are: `event`, `channel`, `id`, `clientId`, `data`, `timestamp`, and `serial`. All of these fields should be consistently available for both commands.

## Problem

The `channels subscribe` and `channels history` commands display messages in inconsistent formats:

**Subscribe** (current):
```
[2026-03-06T05:13:09.160Z] Channel: test | Event: (none)
Data: hello
```
- Shows Channel and Event on one line, Data on next line
- Missing fields: `id`, `clientId`, `serial`

**History** (current):
```
[1] 2026-03-06T05:19:36.130Z
Event: (none)
Client ID: ably-cli-d6d6be45
Data:
hello
```
- Index `[1]` is useful for ordering per CLAUDE.md convention — keep it
- Timestamp on same line as index, not as a separate labeled field
- Missing fields: `channel`, `id`, `serial`
- Data value is on a separate line from the `Data:` label (inconsistent with subscribe where simple data is inline)

**Subscribe JSON** (current `--json`):
```json
{
  "channel": "test",
  "clientId": "...",
  "connectionId": "...",
  "data": "hello",
  "encoding": "...",
  "event": "(none)",
  "id": "msg-123",
  "timestamp": "2026-03-06T05:13:09.160Z"
}
```
- Missing: `serial`

**History JSON** (current `--json`):
```json
{
  "messages": [
    {
      "id": "msg-1",
      "name": "test-event",
      "data": { "text": "Hello world" },
      "timestamp": 1700000000000,
      "clientId": "client-1",
      "connectionId": "conn-1"
    }
  ]
}
```
- Missing: `channel`, `serial`
- Uses `name` instead of `event`
- Timestamp is raw milliseconds, not ISO string

## Target Format

Both commands must display **exactly the same fields in the same format**. Required fields:
`timestamp`, `channel`, `event`, `id`, `clientId`, `serial`, `data`

### Human-readable output

Each field on its own line, all at the same level. Coloring follows CLAUDE.md conventions:
- **Secondary labels**: `chalk.dim("Label:")` — for all field names
- **Resource names** (channel): `resource(name)` — cyan
- **Event types**: `chalk.yellow(eventType)`
- **Client IDs**: `chalk.blue(clientId)`
- **Data**: For simple values, inline on same line as label. For JSON objects/arrays, label on its own line then formatted JSON below.
- **Index prefix (history only)**: Per CLAUDE.md convention, history output uses `[index]` prefix on the first line. Subscribe output does not include index numbers (but supports `--sequence-numbers` flag for optional sequence prefix).

Single message (subscribe):
```
Timestamp: 2026-03-06T05:13:09.160Z
Channel: test
Event: greeting
ID: msg-123
Client ID: publisher-client
Serial: 01826232064561-001@e]GBiqkIkBnR52:001
Data: hello world
```

Single message (history):
```
[1]
Timestamp: 2026-03-06T05:13:09.160Z
Channel: test
Event: greeting
ID: msg-123
Client ID: publisher-client
Serial: 01826232064561-001@e]GBiqkIkBnR52:001
Data: hello world
```

For JSON data (subscribe):
```
Timestamp: 2026-03-06T05:13:09.160Z
Channel: test
Event: greeting
ID: msg-123
Client ID: publisher-client
Serial: 01826232064561-001@e]GBiqkIkBnR52:001
Data:
{
  "text": "hello world"
}
```

Multiple messages (history), separated by blank lines:
```
[1]
Timestamp: 2026-03-06T05:13:09.160Z
Channel: test
Event: greeting
ID: msg-123
Client ID: publisher-client
Serial: 01826232064561-001@e]GBiqkIkBnR52:001
Data: hello world

[2]
Timestamp: 2026-03-06T05:13:10.200Z
Channel: test
Event: update
ID: msg-124
Client ID: another-client
Serial: 01826232064562-001@e]GBiqkIkBnR52:002
Data:
{
  "status": "active"
}
```

Multiple messages (subscribe stream), separated by blank lines:
```
Timestamp: 2026-03-06T05:13:09.160Z
Channel: test
Event: greeting
ID: msg-123
Client ID: publisher-client
Serial: 01826232064561-001@e]GBiqkIkBnR52:001
Data: hello world

Timestamp: 2026-03-06T05:13:10.200Z
Channel: test
Event: update
ID: msg-124
Client ID: another-client
Serial: 01826232064562-001@e]GBiqkIkBnR52:002
Data:
{
  "status": "active"
}
```

### JSON output (--json flag)

Both commands must include all required fields with consistent naming and formatting.

**Subscribe JSON** — emits one JSON object per message (streaming, one at a time):
```json
{
  "timestamp": "2026-03-06T05:13:09.160Z",
  "channel": "test",
  "event": "greeting",
  "id": "msg-123",
  "clientId": "publisher-client",
  "serial": "01826232064561-001@e]GBiqkIkBnR52:001",
  "data": "hello world"
}
```

Changes from current:
- Add `serial` field (from `message.serial`)
- Remove `connectionId` and `encoding` (not in required fields)

**History JSON** — emits an array of message objects:
```json
[
  {
    "timestamp": "2023-11-14T22:13:20.000Z",
    "channel": "test",
    "event": "test-event",
    "id": "msg-1",
    "clientId": "client-1",
    "serial": "01826232064561-001@e]GBiqkIkBnR52:001",
    "data": { "text": "Hello world" }
  },
  {
    "timestamp": "2023-11-14T22:13:21.000Z",
    "channel": "test",
    "event": "another-event",
    "id": "msg-2",
    "clientId": "client-2",
    "serial": "01826232064562-001@e]GBiqkIkBnR52:002",
    "data": "Plain text message"
  }
]
```

Changes from current:
- Output a plain JSON array instead of `{ messages: [...] }` wrapper
- Add `channel` field (from args)
- Add `serial` field (from `message.serial`)
- Rename `name` → `event` for consistency
- Convert `timestamp` from raw milliseconds to ISO 8601 string
- Remove `connectionId` (not in required fields)

### Design decisions

- **Each field on its own line** — consistent, scannable, easy to grep
- **Timestamp is a regular field** — `Timestamp:` label like all others, not a special `[brackets]` header
- **No indentation** — all fields at the same level, no nesting
- **Field order**: (Index for history) → Timestamp → Channel → Event → ID → Client ID → Serial → Data
- **Missing values**: `(none)` for missing event name. Omit fields entirely if not available (e.g. if `clientId` is undefined, don't show the Client ID line). Exception: Event always shown, using `(none)` as fallback.
- **Index numbers (history only)**: Per CLAUDE.md convention, history output keeps `[1]`, `[2]` index prefix on its own line before each message. Subscribe does not use index numbers (but supports `--sequence-numbers` flag).
- **Coloring**: Applied per CLAUDE.md conventions listed above. No unnecessary coloring on plain values (id, serial, data strings).
- **Blank line separator**: Between messages in multi-message output.
- **JSON consistency**: Both commands use the same field names (`event` not `name`), same timestamp format (ISO 8601), same field set.
- **History JSON is a plain array**: No `{ messages: [...] }` wrapper — just the array directly, which is simpler and more consistent with subscribe's per-message objects.
- **Sequence numbers (subscribe only)**: When `--sequence-numbers` flag is used, a sequence prefix `[N]` is prepended to the first line. This is handled via the `sequencePrefix` field in `MessageDisplayFields`.

## Implementation Steps

### 1. Add `formatMessagesOutput` helper to `src/utils/output.ts`

Create a single shared function that accepts an array of messages.

**Important**: Import `isJsonData` and `formatMessageData` from `src/utils/json-formatter.ts`. Do NOT use `formatTimestamp()` (which wraps in `[brackets]`) — display the raw ISO string directly.

```typescript
import { isJsonData, formatMessageData } from "./json-formatter.js";

export interface MessageDisplayFields {
  channel: string;
  clientId?: string;
  data: unknown;
  event: string;
  id?: string;
  indexPrefix?: string;      // For history: "[1]", "[2]", etc.
  sequencePrefix?: string;   // For subscribe with --sequence-numbers: "[1]", "[2]", etc.
  serial?: string;
  timestamp: string;
}

/**
 * Format an array of messages for human-readable console output.
 * Each message shows all fields on separate lines, messages separated by blank lines.
 * Returns "No messages found." for empty arrays.
 */
export function formatMessagesOutput(messages: MessageDisplayFields[]): string
```

The function:
- Returns `"No messages found."` for empty arrays
- For each message, builds lines:
  - (if indexPrefix) `${chalk.dim(indexPrefix)}` on its own line
  - `${sequencePrefix || ""}${chalk.dim("Timestamp:")} ${timestamp}` — raw ISO string, NOT `formatTimestamp()`
  - `${chalk.dim("Channel:")} ${resource(channel)}`
  - `${chalk.dim("Event:")} ${chalk.yellow(event)}`
  - (if id) `${chalk.dim("ID:")} ${id}`
  - (if clientId) `${chalk.dim("Client ID:")} ${chalk.blue(clientId)}`
  - (if serial) `${chalk.dim("Serial:")} ${serial}`
  - Data: Use `isJsonData(data)` to decide:
    - Simple data: `${chalk.dim("Data:")} ${String(data)}` (inline on same line)
    - JSON data: `${chalk.dim("Data:")}\n${formatMessageData(data)}` (label on its own line, formatted JSON below)
- Joins messages with `\n\n` (blank line separator)

### 2. Add `toMessageJson` helper to `src/utils/output.ts`

Create a single helper that normalizes one message into the consistent JSON shape. For arrays, callers simply use `.map(toMessageJson)`:

```typescript
/**
 * Convert a single MessageDisplayFields to a plain object for JSON output.
 * Includes all required fields, omits undefined optional fields.
 *
 * Usage:
 *   Single message (subscribe):  toMessageJson(msg)
 *   Array of messages (history): messages.map(toMessageJson)
 */
export function toMessageJson(msg: MessageDisplayFields): Record<string, unknown>
```

Returns:
```typescript
{
  timestamp: msg.timestamp,
  channel: msg.channel,
  event: msg.event,
  ...(msg.id ? { id: msg.id } : {}),
  ...(msg.clientId ? { clientId: msg.clientId } : {}),
  ...(msg.serial ? { serial: msg.serial } : {}),
  data: msg.data,
}
```

### 3. Update `src/commands/channels/subscribe.ts`

- Import `formatMessagesOutput`, `toMessageJson` from `../../utils/output.js`
- Remove imports of `formatMessageData` from `../../utils/json-formatter.js`
- Remove imports of `formatTimestamp` from `../../utils/output.js` (no longer needed — `formatMessagesOutput` handles timestamp display)
- Keep imports of `formatMessageTimestamp`, `listening`, `progress`, `resource`, `success` from `../../utils/output.js`
- Remove `chalk` import (no longer needed for message formatting)
- Add `serial` to the message fields (from `message.serial`)
- Build a `MessageDisplayFields` object from the Ably message:
  ```typescript
  const msgFields: MessageDisplayFields = {
    channel: channel.name,
    clientId: message.clientId,
    data: message.data,
    event: message.name || "(none)",
    id: message.id,
    serial: message.serial,
    timestamp,
    ...(flags["sequence-numbers"] ? { sequencePrefix: `${chalk.dim(`[${this.sequenceCounter}]`)} ` } : {}),
  };
  ```
  Note: If `sequencePrefix` uses chalk, keep the chalk import. Otherwise remove it.
- Human output: `this.log(formatMessagesOutput([msgFields]))`
- JSON output: Build from `toMessageJson`, then add `sequence` if `--sequence-numbers`:
  ```typescript
  const jsonMsg = toMessageJson(msgFields);
  if (flags["sequence-numbers"]) {
    jsonMsg.sequence = this.sequenceCounter;
  }
  this.log(this.formatJsonOutput(jsonMsg, flags));
  ```
- Remove `connectionId` and `encoding` from user-facing JSON output (the `toMessageJson` helper handles this)
- Keep the `logCliEvent` call with full message details (including `connectionId`, `encoding`, `serial`) — this is internal verbose logging, not user-facing output

### 4. Update `src/commands/channels/history.ts`

- Import `formatMessagesOutput`, `toMessageJson`, `MessageDisplayFields` from `../../utils/output.js`
- Remove imports of `formatMessageData` from `../../utils/json-formatter.js`
- Remove imports of `countLabel`, `formatTimestamp` from `../../utils/output.js` (no longer needed)
- Keep imports of `formatMessageTimestamp`, `limitWarning`, `resource` from `../../utils/output.js`
- Build a `MessageDisplayFields[]` array from history results:
  ```typescript
  const displayMessages: MessageDisplayFields[] = messages.map((message, index) => ({
    channel: channelName,
    clientId: message.clientId,
    data: message.data,
    event: message.name || "(none)",
    id: message.id,
    indexPrefix: `[${index + 1}]`,
    serial: message.serial,
    timestamp: formatMessageTimestamp(message.timestamp),
  }));
  ```
- Human output: `this.log(formatMessagesOutput(displayMessages))`
  - The "No messages found" case is handled by `formatMessagesOutput` returning the appropriate string
  - Remove the for-loop and the "Found N messages" header (index is now part of `MessageDisplayFields`)
  - **Preserve `limitWarning`** after `formatMessagesOutput`:
    ```typescript
    const warning = limitWarning(messages.length, flags.limit, "messages");
    if (warning) this.log(warning);
    ```
- JSON output: `this.log(this.formatJsonOutput(displayMessages.map(toMessageJson), flags))`
  - Output a plain array instead of `{ messages: [...] }` wrapper
- **Keep current error handling** — do NOT switch to `handleCommandError()` because the test expects the `"Error retrieving channel history: "` prefix (see finding #3 above). The current `this.jsonError()` + `this.error()` pattern is fine for this PR.

### 5. Update `.claude/CLAUDE.md`

Add a "Message display" subsection under "CLI Output & Flag Conventions". Also update the existing "History output" bullet to note that `channels history` now uses the new format.

Update the existing "History output" bullet (line 191):
```markdown
- **History output**: Use `[index] timestamp` ordering: `` `${chalk.dim(`[${index + 1}]`)} ${formatTimestamp(timestamp)}` ``. Consistent across log history commands (logs, connection-lifecycle, push). Exception: `channels history` uses `formatMessagesOutput()` with `indexPrefix` for richer field display.
```

Add new subsection:
```markdown
### Message display (channels subscribe, channels history, etc.)
- Use `formatMessagesOutput()` from `src/utils/output.ts` for all message rendering
- Use `toMessageJson()` for consistent JSON output shape; for arrays use `.map(toMessageJson)`
- Each field on its own line, no indentation — all fields at the same level
- Field order: (Index for history) → Timestamp → Channel → Event → ID → Client ID → Serial → Data
- History output includes `[index]` prefix per existing convention; subscribe does not (but supports `--sequence-numbers`)
- Omit optional fields (ID, Client ID, Serial) if the value is undefined/null
- Event always shown; use `(none)` when message has no event name
- Data: inline for simple values, block for JSON objects/arrays (uses `isJsonData()` to decide)
- Multiple messages separated by blank lines
- JSON output uses consistent field names (`event` not `name`), ISO 8601 timestamps
- `formatMessagesOutput` does NOT use `formatTimestamp()` (which adds `[brackets]`) — it displays raw ISO strings
```

### 6. Update tests

- `test/unit/commands/channels/subscribe.test.ts`:
  - Update assertion for "Event: test-event" (still present)
  - Add checks for new fields: "Timestamp:", "Channel:", "ID:", "Client ID:", "Serial:"
  - Update JSON test if needed (serial field added, connectionId/encoding removed)

- `test/unit/commands/channels/history.test.ts`:
  - Keep assertion for `[1]` index format (per CLAUDE.md convention)
  - Update to match new field layout: "Timestamp:", "Channel:", "Event:", "ID:", "Serial:"
  - Update JSON test: now expects a plain array instead of `{ messages: [...] }`, with `event` instead of `name`, ISO timestamp instead of milliseconds

### 7. Verify E2E compatibility

The E2E test (`test/e2e/channels/channel-subscribe-e2e.test.ts`) only checks `output.includes("Subscribe E2E Test")` — unaffected by format changes.

## Files Changed

1. `src/utils/output.ts` — Add `MessageDisplayFields` interface, `formatMessagesOutput()`, `toMessageJson()`. Import `isJsonData`/`formatMessageData` from `json-formatter.ts`.
2. `src/commands/channels/subscribe.ts` — Use `formatMessagesOutput([msg])` + `toMessageJson(msg)`, add `serial`, remove `connectionId`/`encoding` from user-facing JSON, add `sequence` to JSON separately when `--sequence-numbers`, keep `logCliEvent` with full details, remove `formatTimestamp`/`formatMessageData` imports (keep `chalk` if `sequencePrefix` uses it).
3. `src/commands/channels/history.ts` — Use `formatMessagesOutput(messages)` + `messages.map(toMessageJson)`, add `channel`/`serial`/`indexPrefix`, plain array JSON, preserve `limitWarning`. Keep current error handling.
4. `.claude/CLAUDE.md` — Add "Message display" conventions subsection, update "History output" bullet to note `channels history` exception.
5. `test/unit/commands/channels/subscribe.test.ts` — ✅ Already updated (survived merge). No changes needed.
6. `test/unit/commands/channels/history.test.ts` — ✅ Already updated (survived merge). No changes needed.
