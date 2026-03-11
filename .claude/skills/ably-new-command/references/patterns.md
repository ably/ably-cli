# Command Implementation Patterns

Pick the pattern that matches your command from Step 1 of the skill, then follow the template below.

## Table of Contents
- [Subscribe Pattern](#subscribe-pattern)
- [Publish/Send Pattern](#publishsend-pattern)
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
      // Use "event" type for streaming records. IMPORTANT: don't use "type" as a
      // data key — it's reserved by the envelope. Use "eventType" instead.
      this.logJsonEvent({
        eventType: "message",  // not "type" — that's reserved by the envelope
        channel: args.channel,
        data: message.data,
        name: message.name,
        timestamp: message.timestamp,
      }, flags);
    } else {
      // Human-readable output with formatTimestamp, formatResource, chalk colors
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
      // Use "result" type for one-shot results. Don't use "success" as a data key
      // for batch summaries — it overrides the envelope's success field. Use "allSucceeded".
      this.logJsonResult({ channel: args.channel }, flags);
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
      this.logJsonResult({ messages }, flags);
    } else {
      this.log(formatSuccess(`Found ${messages.length} messages.`));
      // Display each message
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
      this.logJsonResult({ resource: args.id, ...data }, flags);
    } else {
      this.log(`Details for ${formatResource(args.id)}:\n`);
      this.log(`${formatLabel("Field")} ${data.field}`);
      this.log(`${formatLabel("Status")} ${data.status}`);
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
      this.logJsonResult({ resource: result }, flags);
    } else {
      this.log(formatSuccess("Resource created: " + formatResource(result.id) + "."));
      // Display additional fields
    }
  } catch (error) {
    this.fail(error, flags, "createResource");
  }
}
```
