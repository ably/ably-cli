# Command Implementation Patterns

Pick the pattern that matches your command from Step 1 of the skill, then follow the template below.

## Table of Contents
- [Subscribe Pattern](#subscribe-pattern)
- [Publish/Send Pattern](#publishsend-pattern)
- [History Pattern](#history-pattern)
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
  this.configureRewind(channelOptions, flags.rewind, flags, "MySubscribe", args.channel);

  const channel = client.channels.get(args.channel, channelOptions);
  this.setupChannelStateLogging(channel, flags);

  if (!this.shouldOutputJson(flags)) {
    this.log(progress("Attaching to channel: " + resource(args.channel)));
  }

  channel.once("attached", () => {
    if (!this.shouldOutputJson(flags)) {
      this.log(success("Attached to channel: " + resource(args.channel) + "."));
      this.log(listening("Listening for events."));
    }
  });

  let sequenceCounter = 0;
  await channel.subscribe((message) => {
    sequenceCounter++;
    // Format and output the message
    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ /* message data */ }, flags));
    } else {
      // Human-readable output with formatTimestamp, resource, chalk colors
    }
  });

  await waitUntilInterruptedOrTimeout(flags);
}
```

Import `waitUntilInterruptedOrTimeout` from `../../utils/long-running.js`.

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
    this.log(progress("Publishing to channel: " + resource(args.channel)));
  }

  try {
    const message: Partial<Ably.Message> = {
      name: flags.name || args.eventName,
      data: args.data,
    };

    await channel.publish(message as Ably.Message);

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ success: true, channel: args.channel }, flags));
    } else {
      this.log(success("Message published to channel: " + resource(args.channel) + "."));
    }
  } catch (error) {
    this.handleCommandError(error, flags, "Publish", { channel: args.channel });
  }
}
```

For multi-message publish or realtime transport, see `src/commands/channels/publish.ts` as a reference.

---

## History Pattern

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyHistoryCommand);

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
    this.log(this.formatJsonOutput({ messages }, flags));
  } else {
    this.log(success(`Found ${messages.length} messages.`));
    // Display each message
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
      this.error("Invalid JSON data provided");
      return;
    }
  }

  if (!this.shouldOutputJson(flags)) {
    this.log(progress("Entering presence on channel: " + resource(args.channel)));
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
    this.log(success("Entered presence on channel: " + resource(args.channel) + "."));
    this.log(listening("Present on channel."));
  }

  await waitUntilInterruptedOrTimeout(flags);
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

List commands query a collection and display results. They don't use `success()` because there's no action to confirm — they just display data.

**Simple identifier lists** (e.g., `channels list`, `rooms list`) — use `resource()` for each item:
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(`Found ${chalk.cyan(items.length.toString())} active channels:`);
  for (const item of items) {
    this.log(`${resource(item.id)}`);
  }
}
```

**Structured record lists** (e.g., `queues list`, `integrations list`, `push devices list`) — use `heading()` and `label()` helpers:
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(`Found ${items.length} devices:\n`);
  for (const item of items) {
    this.log(heading(`Device ID: ${item.id}`));
    this.log(`  ${label("Platform")} ${item.platform}`);
    this.log(`  ${label("Push State")} ${item.pushState}`);
    this.log(`  ${label("Client ID")} ${item.clientId || "N/A"}`);
    this.log("");
  }
}
```

Full Control API list command template:
```typescript
async run(): Promise<void> {
  const { flags } = await this.parse(MyListCommand);

  const controlApi = this.createControlApi(flags);
  const appId = await this.resolveAppId(flags);

  if (!appId) {
    this.error('No app specified. Use --app flag or select an app with "ably apps switch"');
    return;
  }

  try {
    const items = await controlApi.listThings(appId);
    const limited = flags.limit ? items.slice(0, flags.limit) : items;

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ items: limited, total: limited.length, appId }, flags));
    } else {
      this.log(`Found ${limited.length} item${limited.length !== 1 ? "s" : ""}:\n`);
      for (const item of limited) {
        this.log(heading(`Item ID: ${item.id}`));
        this.log(`  ${label("Type")} ${item.type}`);
        this.log(`  ${label("Status")} ${item.status}`);
        this.log("");
      }
    }
  } catch (error) {
    this.error(`Error listing items: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

Key conventions for list output:
- `resource()` is for inline resource name references, not for record headings
- `heading()` is for record heading lines that act as visual separators between multi-field records
- `label(text)` for field labels in detail lines (automatically appends `:`)
- `success()` is not used in list commands — it's for confirming an action completed

---

## CRUD / Control API Pattern

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MyControlCommand);

  const controlApi = this.createControlApi(flags);
  const appId = await this.resolveAppId(flags);

  if (!appId) {
    this.error('No app specified. Use --app flag or select an app with "ably apps switch"');
    return;
  }

  try {
    const result = await controlApi.someMethod(appId, data);

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ result }, flags));
    } else {
      this.log(success("Resource created: " + resource(result.id) + "."));
      // Display additional fields
    }
  } catch (error) {
    this.error(`Error creating resource: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```
