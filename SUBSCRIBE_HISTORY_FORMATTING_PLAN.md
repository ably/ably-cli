# Implementation Plan: Consistent Message Output for channels subscribe & history

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

Create a single shared function that accepts an array of messages:

```typescript
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
  - `${sequencePrefix || ""}${chalk.dim("Timestamp:")} ${timestamp}`
  - `${chalk.dim("Channel:")} ${resource(channel)}`
  - `${chalk.dim("Event:")} ${chalk.yellow(event)}`
  - (if id) `${chalk.dim("ID:")} ${id}`
  - (if clientId) `${chalk.dim("Client ID:")} ${chalk.blue(clientId)}`
  - (if serial) `${chalk.dim("Serial:")} ${serial}`
  - Data: `${chalk.dim("Data:")} ${value}` for simple, or `${chalk.dim("Data:")}` + formatted JSON block on next lines
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

- Import `formatMessagesOutput`, `toMessageJson`
- Remove imports of `formatJson`, `isJsonData`, `formatTimestamp`
- Add `serial` to the message fields (from `message.serial`)
- Build a `MessageDisplayFields` object from the Ably message
- Human output: `this.log(formatMessagesOutput([msgFields]))`
- JSON output: `this.log(this.formatJsonOutput(toMessageJson(msgFields), flags))`
- Remove `connectionId` and `encoding` from JSON output

### 4. Update `src/commands/channels/history.ts`

- Import `formatMessagesOutput`, `toMessageJson` from output utils
- Build a `MessageDisplayFields[]` array from history results:
  - `channel` from `args.channel`
  - `event` from `message.name || "(none)"`
  - `serial` from `message.serial`
  - `timestamp` as ISO string (convert from milliseconds)
  - `indexPrefix` as `[${index + 1}]` (per CLAUDE.md convention for history output)
- Human output: `this.log(formatMessagesOutput(displayMessages))`
  - The "No messages found" case is handled by `formatMessagesOutput` returning the appropriate string
  - Remove the for-loop and the "Found N messages" header (index is now part of `MessageDisplayFields`)
- JSON output: `this.log(this.formatJsonOutput(displayMessages.map(toMessageJson), flags))`
  - Output a plain array instead of `{ messages: [...] }` wrapper

### 5. Update `.claude/CLAUDE.md`

Add a "Message display" subsection under "CLI Output & Flag Conventions". Note: The existing "History output" convention (line 219) with `[index] timestamp` ordering is preserved — history commands continue to use index prefixes.

```markdown
### Message display (channels subscribe, channels history, etc.)
- Use `formatMessagesOutput()` from `src/utils/output.ts` for all message rendering
- Use `toMessageJson()` for consistent JSON output shape; for arrays use `.map(toMessageJson)`
- Each field on its own line, no indentation — all fields at the same level
- Field order: (Index for history) → Timestamp → Channel → Event → ID → Client ID → Serial → Data
- History output includes `[index]` prefix per existing convention; subscribe does not (but supports `--sequence-numbers`)
- Omit optional fields (ID, Client ID, Serial) if the value is undefined/null
- Event always shown; use `(none)` when message has no event name
- Data: inline for simple values, block for JSON objects/arrays
- Multiple messages separated by blank lines
- JSON output uses consistent field names (`event` not `name`), ISO 8601 timestamps
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

1. `src/utils/output.ts` — Add `formatMessagesOutput`, `toMessageJson`, and `MessageDisplayFields`
2. `src/commands/channels/subscribe.ts` — Use `formatMessagesOutput([msg])` + `toMessageJson(msg)`, add serial
3. `src/commands/channels/history.ts` — Use `formatMessagesOutput(messages)` + `messages.map(toMessageJson)`, add channel/serial/indexPrefix, plain array JSON
4. `.claude/CLAUDE.md` — Document message display conventions (note: existing history output convention with `[index]` is preserved)
5. `test/unit/commands/channels/subscribe.test.ts` — Update assertions for new format
6. `test/unit/commands/channels/history.test.ts` — Update assertions for new format + JSON structure
