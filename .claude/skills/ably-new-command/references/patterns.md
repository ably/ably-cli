# Command Implementation Patterns

Pick the pattern that matches your command from Step 1 of the skill, then follow the template below.

## Table of Contents
- [Subscribe Pattern](#subscribe-pattern)
- [Publish/Send Pattern](#publishsend-pattern)
- [REST Mutation Pattern](#rest-mutation-pattern)
- [History Pattern](#history-pattern)
- [Get Pattern](#get-pattern)
- [Enter/Presence Pattern](#enterpresence-pattern)
- [List Pattern](#list-pattern)
- [CRUD / Control API Pattern](#crud--control-api-pattern)

---

## Subscribe Pattern

Flags for subscribe commands:
```typescript
static override flags = {
  ...productApiFlags,
  ...clientIdFlag,
  ...durationFlag,
  ...rewindFlag,
  // command-specific flags here
};
```

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MySubscribeCommand);

  const client = await this.createAblyRealtimeClient(flags);
  if (!client) return;

  this.setupConnectionStateLogging(client, flags);

  const channelOptions: Ably.ChannelOptions = {};
  this.configureRewind(channelOptions, flags.rewind, flags, "subscribe", args.channel);

  const channel = client.channels.get(args.channel, channelOptions);
  // Shared helper that monitors channel state changes and logs them (verbose mode).
  // Returns a cleanup function, but cleanup is handled automatically by base command.
  this.setupChannelStateLogging(channel, flags);

  if (!this.shouldOutputJson(flags)) {
    this.log(formatProgress("Attaching to channel: " + formatResource(args.channel)));
  }

  channel.once("attached", () => {
    if (!this.shouldOutputJson(flags)) {
      this.log(formatSuccess("Attached to channel: " + formatResource(args.channel) + "."));
      this.log(formatListening("Listening for events."));
    }
  });

  let sequenceCounter = 0;
  await channel.subscribe((message) => {
    sequenceCounter++;
    // Format and output the message
    if (this.shouldOutputJson(flags)) {
      // Nest data under a singular domain key. IMPORTANT: don't use "type" as a
      // data key — it's reserved by the envelope. Use "eventType" instead.
      this.logJsonEvent({
        message: {
          id: message.id,
          timestamp: message.timestamp,
          channel: args.channel,
          event: message.name,
          clientId: message.clientId,
          serial: message.serial,
          data: message.data,
        },
      }, flags);
    } else {
      // Human-readable output — multi-line labeled block per event
      // Use shared formatters where available (e.g., formatMessagesOutput for channels)
      const timestamp = formatMessageTimestamp(message.timestamp);
      this.log(formatTimestamp(timestamp));
      if (message.id) this.log(`${formatLabel("ID")} ${message.id}`);
      this.log(`${formatLabel("Timestamp")} ${timestamp}`);
      this.log(`${formatLabel("Channel")} ${formatResource(args.channel)}`);
      this.log(`${formatLabel("Event")} ${formatEventType(message.name || "(none)")}`);
      if (message.clientId) this.log(`${formatLabel("Client ID")} ${formatClientId(message.clientId)}`);
      if (message.serial) this.log(`${formatLabel("Serial")} ${message.serial}`);
      this.log(`${formatLabel("Data")} ${String(message.data)}`);
      this.log(""); // blank line between events
    }
  });

  await this.waitAndTrackCleanup(flags, "subscribe", flags.duration);
}
```

---

## Publish/Send Pattern

Flags for publish commands:
```typescript
static override flags = {
  ...productApiFlags,
  ...clientIdFlag,
  // command-specific flags (e.g., --name, --encoding, --count, --delay)
};
```

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyPublishCommand);

  const rest = await this.createAblyRestClient(flags);
  if (!rest) return;

  const channel = rest.channels.get(args.channel);

  if (!this.shouldOutputJson(flags)) {
    this.log(formatProgress("Publishing to channel: " + formatResource(args.channel)));
  }

  try {
    const message: Partial<Ably.Message> = {
      name: flags.name || args.eventName,
      data: args.data,
    };

    await channel.publish(message as Ably.Message);

    if (this.shouldOutputJson(flags)) {
      // Nest data under a domain key. Don't use "success" as a data key
      // for batch summaries — it overrides the envelope's success field. Use "allSucceeded".
      this.logJsonResult({ message: { channel: args.channel, name: message.name, data: message.data } }, flags);
    } else {
      this.log(formatSuccess("Message published to channel: " + formatResource(args.channel) + "."));
    }
  } catch (error) {
    this.fail(error, flags, "publish", { channel: args.channel });
  }
}
```

For multi-message publish or realtime transport, see `src/commands/channels/publish.ts` as a reference.

**When to use Realtime instead of REST for publishing:**
- When publishing multiple messages with a count/repeat loop (continuous publishing with delays between messages)
- When the command also subscribes to the same channel (publish + subscribe in one command)
- When the command needs to maintain a persistent connection for other reasons

For single-shot publish, REST is preferred (simpler, no connection overhead). See `src/commands/channels/publish.ts` which supports both via a `--transport` flag.

---

## REST Mutation Pattern

For one-shot SDK operations that are pure REST calls (send, update, delete, annotate, history, occupancy get). These do **NOT** need `room.attach()` or `space.enter()` — they only need a room/space handle. In the Chat SDK, methods that go through `this._chatApi.*` are REST-based, while methods that use `this._channel.publish()` or `this._channel.presence.*` require realtime attachment.

Flags for REST mutation commands:
```typescript
static override flags = {
  ...productApiFlags,
  ...clientIdFlag,  // Users may want to test "can client B update client A's message?"
  // command-specific flags here
};
```

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyMutationCommand);

  try {
    const chatClient = await this.createChatClient(flags);
    if (!chatClient) {
      return this.fail("Failed to create Chat client", flags, "roomMessageUpdate");
    }

    this.setupConnectionStateLogging(chatClient.realtime, flags);

    // NO room.attach() — update/delete/annotate are REST calls
    const room = await chatClient.rooms.get(args.room);

    if (!this.shouldOutputJson(flags)) {
      this.log(formatProgress("Updating message " + formatResource(args.serial) + " in room " + formatResource(args.room)));
    }

    const result = await room.messages.update(args.serial, updateParams, details);

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult({ room: args.room, serial: args.serial, versionSerial: result.version.serial }, flags);
    } else {
      this.log(formatSuccess(`Message ${formatResource(args.serial)} updated in room ${formatResource(args.room)}.`));
    }
  } catch (error) {
    this.fail(error, flags, "roomMessageUpdate", { room: args.room, serial: args.serial });
  }
}
```

**Key difference from Subscribe/Send:** No `room.attach()`, no `durationFlag`, no `rewindFlag`, no `waitAndTrackCleanup`. The command creates the client, gets the room handle, calls the REST method, and exits.

See `src/commands/rooms/messages/update.ts` and `src/commands/rooms/messages/delete.ts` as references.

---

## History Pattern

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyHistoryCommand);

  try {
    const rest = await this.createAblyRestClient(flags);
    if (!rest) return;

    const channel = rest.channels.get(args.channel);

    const historyParams = {
      direction: flags.direction,
      limit: flags.limit,
      ...(flags.start && { start: parseTimestamp(flags.start) }),
      ...(flags.end && { end: parseTimestamp(flags.end) }),
    };

    const history = await channel.history(historyParams);
    const messages = history.items;

    if (this.shouldOutputJson(flags)) {
      // Plural domain key for collections, optional metadata alongside
      this.logJsonResult({ messages, total: messages.length }, flags);
    } else {
      this.log(formatSuccess(`Found ${messages.length} messages.`));
      // Display each message using multi-line labeled blocks
    }
  } catch (error) {
    this.fail(error, flags, "history", { channel: args.channel });
  }
}
```

---

## Get Pattern

Get commands perform one-shot queries for current state. They use REST clients and don't need `clientIdFlag`, `durationFlag`, or `rewindFlag`.

```typescript
static override flags = {
  ...productApiFlags,
  // command-specific flags here
};
```

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyGetCommand);

  try {
    const client = await this.createAblyRestClient(flags);
    if (!client) return;

    // Fetch the resource data
    const result = await client.request("get", `/resource/${encodeURIComponent(args.id)}`, 2);
    const data = result.items?.[0] || {};

    if (this.shouldOutputJson(flags)) {
      // Singular domain key for single-item results
      this.logJsonResult({ resource: data }, flags);
    } else {
      // Multi-line labeled block — one field per line, using formatLabel for all labels
      this.log(`Details for ${formatResource(args.id)}:\n`);
      this.log(`${formatLabel("Field")} ${data.field}`);
      this.log(`${formatLabel("Status")} ${data.status}`);
      if (data.clientId) this.log(`${formatLabel("Client ID")} ${formatClientId(data.clientId)}`);
      // Omit null/undefined fields, show everything else
    }
  } catch (error) {
    this.fail(error, flags, "resourceGet", { resource: args.id });
  }
}
```

---

## Enter/Presence Pattern

Flags for enter commands:
```typescript
static override flags = {
  ...productApiFlags,
  ...clientIdFlag,
  ...durationFlag,
  data: Flags.string({ description: "Optional JSON data to associate with the presence" }),
  "show-others": Flags.boolean({ default: false, description: "Show other presence events while present (default: false)" }),
};
```

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyEnterCommand);

  const client = await this.createAblyRealtimeClient(flags);
  if (!client) return;

  this.setupConnectionStateLogging(client, flags);

  const channel = client.channels.get(args.channel);
  this.setupChannelStateLogging(channel, flags);

  // Parse optional JSON data (handle shell quote stripping)
  let presenceData;
  if (flags.data) {
    try {
      presenceData = JSON.parse(flags.data);
    } catch {
      this.fail("Invalid JSON data provided", flags, "presenceEnter");
    }
  }

  if (!this.shouldOutputJson(flags)) {
    this.log(formatProgress("Entering presence on channel: " + formatResource(args.channel)));
  }

  // Optionally subscribe to other members' events before entering
  if (flags["show-others"]) {
    await channel.presence.subscribe((msg) => {
      if (msg.clientId === client.auth.clientId) return; // filter self
      // Display presence event
    });
  }

  await channel.presence.enter(presenceData);

  if (!this.shouldOutputJson(flags)) {
    this.log(formatSuccess("Entered presence on channel: " + formatResource(args.channel) + "."));
    this.log(formatListening("Present on channel."));
  }

  await this.waitAndTrackCleanup(flags, "presence", flags.duration);
}

// Clean up in finally — leave presence before closing connection
async finally(err: Error | undefined): Promise<void> {
  if (this.channel) {
    await this.channel.presence.leave();
  }
  return super.finally(err);
}
```

---

## List Pattern

List commands query a collection and display results. They don't use `formatSuccess()` because there's no action to confirm — they just display data.

**Simple identifier lists** (e.g., `channels list`, `rooms list`) — use `formatResource()` for each item:
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(`Found ${chalk.cyan(items.length.toString())} active channels:`);
  for (const item of items) {
    this.log(`${formatResource(item.id)}`);
  }
}
```

**Structured record lists** (e.g., `queues list`, `integrations list`, `push devices list`) — use `formatHeading()` and `formatLabel()` helpers:
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(`Found ${items.length} devices:\n`);
  for (const item of items) {
    this.log(formatHeading(`Device ID: ${item.id}`));
    this.log(`  ${formatLabel("Platform")} ${item.platform}`);
    this.log(`  ${formatLabel("Push State")} ${item.pushState}`);
    this.log(`  ${formatLabel("Client ID")} ${item.clientId || "N/A"}`);
    this.log("");
  }
}
```

Full Control API list command template:
```typescript
async run(): Promise<void> {
  const { flags } = await this.parse(MyListCommand);

  const appId = await this.requireAppId(flags);

  try {
    const controlApi = this.createControlApi(flags);
    const items = await controlApi.listThings(appId);
    const limited = flags.limit ? items.slice(0, flags.limit) : items;

    if (this.shouldOutputJson(flags)) {
      // Plural domain key for collections, metadata alongside
      this.logJsonResult({ items: limited, total: limited.length, appId }, flags);
    } else {
      this.log(`Found ${limited.length} item${limited.length !== 1 ? "s" : ""}:\n`);
      for (const item of limited) {
        this.log(formatHeading(`Item ID: ${item.id}`));
        this.log(`  ${formatLabel("Type")} ${item.type}`);
        this.log(`  ${formatLabel("Status")} ${item.status}`);
        this.log("");
      }
    }
  } catch (error) {
    this.fail(error, flags, "listItems");
  }
}
```

Key conventions for list output:
- `formatResource()` is for inline resource name references, not for record headings
- `formatHeading()` is for record heading lines that act as visual separators between multi-field records
- `formatLabel(text)` for field labels in detail lines (automatically appends `:`)
- `formatSuccess()` is not used in list commands — it's for confirming an action completed

---

## CRUD / Control API Pattern

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyControlCommand);

  const appId = await this.requireAppId(flags);

  try {
    const controlApi = this.createControlApi(flags);
    const result = await controlApi.someMethod(appId, data);

    if (this.shouldOutputJson(flags)) {
      // Singular domain key for single-item results
      this.logJsonResult({ resource: result }, flags);
    } else {
      this.log(formatSuccess("Resource created: " + formatResource(result.id) + "."));
      // Display additional fields using formatLabel
      this.log(`${formatLabel("Status")} ${result.status}`);
      this.log(`${formatLabel("Created")} ${new Date(result.createdAt).toISOString()}`);
    }
  } catch (error) {
    this.fail(error, flags, "createResource");
  }
}
```

---

## Human-Readable Output Format

All non-JSON output for data records uses **multi-line labeled blocks**. Never use ASCII tables, box-drawing characters (`┌─┬─┐`, `│`), or custom grid layouts.

### Streaming events (subscribe commands)

Each event is a multi-line block with a timestamp header, then labeled fields. Separate events with a blank line.

```
[2024-01-15T10:30:00.000Z]
ID: msg-123
Timestamp: 2024-01-15T10:30:00.000Z
Channel: my-channel
Event: message.created
Client ID: user-123
Serial: 01H...
Data: {"key": "value"}
```

Code pattern:
```typescript
// In the event handler callback
const timestamp = formatMessageTimestamp(message.timestamp);
this.log(formatTimestamp(timestamp));                                    // dim [timestamp] header
if (message.id) this.log(`${formatLabel("ID")} ${message.id}`);
this.log(`${formatLabel("Timestamp")} ${timestamp}`);
this.log(`${formatLabel("Channel")} ${formatResource(channelName)}`);
this.log(`${formatLabel("Event")} ${formatEventType(message.name)}`);
if (message.clientId) this.log(`${formatLabel("Client ID")} ${formatClientId(message.clientId)}`);
this.log(`${formatLabel("Data")} ${String(message.data)}`);
this.log("");  // blank line separator
```

For domain-specific events, create shared formatting functions in the appropriate utils file (e.g., `src/utils/spaces-output.ts` for spaces, `src/utils/output.ts` for channels).

### One-shot results with multiple records (get-all)

Use `formatIndex()` for numbering and `formatCountLabel()` for the heading. Index goes on its own line, fields are indented below it.

```
Current cursors (3 cursors):

[1]
  Client ID: user-123
  Connection ID: conn-abc
  Position X: 150
  Position Y: 300
  Data: {"color": "red"}

[2]
  Client ID: user-456
  Connection ID: conn-def
  Position X: 200
  Position Y: 400
```

Code pattern:
```typescript
this.log(`${formatHeading("Current cursors")} (${formatCountLabel(items.length, "cursor")}):\n`);
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  this.log(`${formatIndex(i + 1)}`);
  this.log(`  ${formatLabel("Client ID")} ${formatClientId(item.clientId)}`);
  this.log(`  ${formatLabel("Connection ID")} ${item.connectionId}`);
  this.log(`  ${formatLabel("Position X")} ${item.position.x}`);
  this.log(`  ${formatLabel("Position Y")} ${item.position.y}`);
  if (item.data) this.log(`  ${formatLabel("Data")} ${JSON.stringify(item.data)}`);
  this.log("");  // blank line between records
}
```

### History results (time-ordered records)

History commands combine `formatIndex()` and `formatTimestamp()` on the same line as a heading, since records are time-ordered. This is distinct from get-all which uses index alone.

```
[1] [2024-01-15T10:30:00.000Z]
  Event: message.created
  Channel: my-channel
  Data: {"key": "value"}

[2] [2024-01-15T10:29:55.000Z]
  Event: message.created
  Channel: my-channel
  Data: {"other": "data"}
```

Code pattern:
```typescript
for (let i = 0; i < messages.length; i++) {
  const msg = messages[i];
  const ts = formatMessageTimestamp(msg.timestamp);
  this.log(`${formatIndex(i + 1)} ${formatTimestamp(ts)}`);  // index + timestamp on same line
  this.log(`  ${formatLabel("Event")} ${formatEventType(msg.name || "(none)")}`);
  this.log(`  ${formatLabel("Channel")} ${formatResource(channelName)}`);
  if (msg.clientId) this.log(`  ${formatLabel("Client ID")} ${formatClientId(msg.clientId)}`);
  this.log(`  ${formatLabel("Data")} ${String(msg.data)}`);
  this.log("");
}
```

### Single record results (get, acquire, set)

Same labeled format, no index needed:

```
Lock ID: my-lock
Status: locked
Timestamp: 2024-01-15T10:30:00.000Z
Member:
  Client ID: user-123
  Connection ID: conn-abc
Attributes: {"priority": "high"}
```

### Field display rules

**Use SDK type definitions as the source of truth** for which fields exist. Before implementing output for a command, read the relevant SDK type definition to ensure all important fields are covered:

| SDK | Type file | Key types |
|-----|-----------|-----------|
| `ably` | `node_modules/ably/ably.d.ts` | `Message`, `PresenceMessage`, `ChannelStateChange`, `ConnectionStateChange` |
| `@ably/spaces` | `node_modules/@ably/spaces/dist/mjs/types.d.ts` | `SpaceMember`, `CursorUpdate`, `CursorPosition`, `CursorData`, `Lock`, `ProfileData` |
| `@ably/chat` | `node_modules/@ably/chat/dist/chat/core/*.d.ts` | `Message` (chat), `PresenceMember`, `OccupancyEvent`, `Reaction` |

**Use SDK source code as the source of truth** for method behavior — whether a method requires prior state (e.g., `space.enter()`), what side effects it has, what it actually returns. When in doubt, read the implementation:

| SDK | Source directory | Key files |
|-----|-----------------|-----------|
| `ably` | `node_modules/ably/` | Realtime, REST, channels, presence |
| `@ably/spaces` | `node_modules/@ably/spaces/dist/mjs/` | `Space.js`, `Members.js`, `Locations.js`, `Cursors.js`, `Locks.js` |
| `@ably/chat` | `node_modules/@ably/chat/dist/chat/core/` | Rooms, messages, presence, reactions |

**Import SDK types directly** — never redefine SDK interfaces locally. If `@ably/spaces` exports `CursorPosition`, import it:
```typescript
// WRONG — local redefinition duplicates SDK type
interface CursorPosition { x: number; y: number; }

// CORRECT — import from SDK
import type { CursorPosition, CursorData, CursorUpdate } from "@ably/spaces";
```

**Display interfaces are fine** — types like `MemberOutput`, `MessageDisplayFields`, `CursorOutput` in `src/utils/` that transform SDK types for output are intentional. They're the right place to decide field naming, null handling, and which fields to include. The SDK type defines what's *available*; the display interface defines what to *present*.

**Field coverage:**
- **Show all available fields** — non-JSON output should expose the same data as JSON mode
- **Omit null/undefined/empty fields** — skip fields with no value (don't show "Profile: null")

**Formatting:**
- **Use `formatLabel("Name")`** for all field labels — it appends `:` and applies dim styling
- **Use type-appropriate formatters**: `formatClientId()` for client IDs, `formatResource()` for resource names, `formatEventType()` for actions, `formatTimestamp()` for timestamp headers
- **Nested objects**: display as `JSON.stringify(data)` on the same line, or indent with `formatMessageData()` for large/multi-line JSON
- **Nested records** (e.g., member inside lock): use 2-space indent for the sub-fields

### Command behavior semantics

Commands must behave strictly according to their documented purpose — no unintended side effects.

**Subscribe commands** — passive observers:
- **Only** listen for new events — must NOT fetch initial state (use `get-all` for that)
- **NOT enter presence/space** — use `enterSpace: false`. The Spaces SDK's `subscribe()` methods do NOT require `space.enter()`
- Use the message pattern: `formatProgress("Subscribing to X")` → `formatListening("Listening for X.")`

**Get-all / get commands** — one-shot queries:
- **NOT enter presence/space** — `getAll()`, `get()` do NOT require `space.enter()`
- **NOT subscribe** to events or poll — fetch once, output, exit

**Set commands** — one-shot mutations:
- Enter space (required by SDK), set value, output, **exit**
- **NOT subscribe** after setting — that is what subscribe commands are for

**Enter / acquire commands** — hold state until Ctrl+C / `--duration`:
- Enter space, output confirmation with all relevant fields, then `waitAndTrackCleanup`
- **NOT subscribe** to other events

**Side-effect rules:**
- `space.enter()` only when SDK requires it (set, enter, acquire)
- Call `this.markAsEntered()` after every `space.enter()` (enables cleanup)
- `initializeSpace(enterSpace: true)` calls `markAsEntered()` automatically

```typescript
// WRONG — subscribe enters the space
await this.initializeSpace(flags, spaceName, { enterSpace: true });
await this.space!.members.subscribe("update", handler);

// CORRECT — subscribe is passive
await this.initializeSpace(flags, spaceName, { enterSpace: false });
await this.space!.members.subscribe("update", handler);

// WRONG — get-all enters the space
await this.space!.enter();
const data = await this.space!.locations.getAll();

// CORRECT — get-all just fetches
const data = await this.space!.locations.getAll();

// WRONG — set command subscribes after setting
await this.space!.locations.set(location);
this.space!.locations.subscribe("update", handler);  // NO
await this.waitAndTrackCleanup(flags, "location");    // NO

// CORRECT — set command exits after setting
await this.space!.locations.set(location);
// run() completes, finally() handles cleanup
```

---

## JSON Data Nesting Convention

The JSON envelope provides three top-level fields (`type`, `command`, `success`). Domain data must be nested under a **domain key**, not spread at the top level.

### Streaming events (logJsonEvent) — singular domain key

```typescript
// CORRECT — nest event payload under a singular domain key
this.logJsonEvent({ message: messageData }, flags);       // → {"type":"event","command":"channels:subscribe","message":{...}}
this.logJsonEvent({ cursor: cursorData }, flags);         // spaces cursors
this.logJsonEvent({ member: memberData }, flags);         // spaces members
this.logJsonEvent({ lock: lockData }, flags);             // spaces locks
this.logJsonEvent({ location: locationData }, flags);     // spaces locations
this.logJsonEvent({ annotation: annotationData }, flags); // channels annotations
this.logJsonEvent({ reaction: reactionData }, flags);     // rooms reactions

// WRONG — spreading fields loses the domain boundary
this.logJsonEvent({ clientId, position, data }, flags);
```

### One-shot single results (logJsonResult) — singular domain key

```typescript
this.logJsonResult({ lock: lockData }, flags);            // → {"type":"result","command":"spaces:locks:get","success":true,"lock":{...}}
this.logJsonResult({ key: keyData }, flags);              // auth keys create
this.logJsonResult({ app: appData }, flags);              // apps create
this.logJsonResult({ rule: ruleData }, flags);            // apps rules create
```

### One-shot collection results (logJsonResult) — plural domain key + metadata

```typescript
this.logJsonResult({ cursors: items }, flags);                        // → {"type":"result","command":"spaces:cursors:get-all","success":true,"cursors":[...]}
this.logJsonResult({ rules: items, appId, total }, flags);            // rules list — metadata alongside collection
this.logJsonResult({ channels: items, total, hasMore }, flags);       // channels list
```

Metadata fields (`total`, `timestamp`, `hasMore`, `appId`) may sit alongside the collection key since they describe the result, not the domain objects.

### Choosing the domain key name

| Scenario | Key | Example |
|----------|-----|---------|
| Single event | Singular noun matching the SDK type | `message`, `cursor`, `member`, `lock` |
| Single result (create/get) | Singular noun | `key`, `app`, `rule`, `lock` |
| Collection result (list/get-all) | Plural noun | `keys`, `apps`, `rules`, `cursors` |

The key name should match the SDK/domain terminology, not be generic. Use `message` not `data`, `cursor` not `item`.
