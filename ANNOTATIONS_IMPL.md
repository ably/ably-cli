# Channels Annotations — Implementation Plan

## 1. Feature Overview

This document describes the implementation approach for adding **Message Annotations** support to the Ably CLI. Annotations allow clients to append metadata (reactions, tags, read receipts, etc.) to existing messages on a channel.

**Reference documentation:** [https://ably.com/docs/messages/annotations.md](https://ably.com/docs/messages/annotations.md)

### New CLI Commands

```
ably channels annotations publish <channelName> <msgSerial> <annotationType>
ably channels annotations delete <channelName> <msgSerial> <annotationType>
ably channels annotations subscribe <channelName>
```

---

## 2. Ably SDK Support

The Ably JS SDK (`ably@^2.14.0`) already provides full annotations support:

| SDK API | Description |
|---------|-------------|
| [`channel.annotations.publish(messageSerial, annotation)`](node_modules/ably/ably.d.ts:2180) | Publish an annotation (action = `annotation.create`) |
| [`channel.annotations.delete(messageSerial, annotation)`](node_modules/ably/ably.d.ts:2201) | Delete an annotation (action = `annotation.delete`) |
| [`channel.annotations.subscribe(listener)`](node_modules/ably/ably.d.ts:2140) | Subscribe to individual annotation events |
| [`channel.annotations.get(messageSerial, params)`](node_modules/ably/ably.d.ts:2216) | Get annotations for a message (paginated) |

### Key Types

- [`OutboundAnnotation`](node_modules/ably/ably.d.ts:3316) — `Partial<Annotation> & { type: string }` — used for publish/delete
- [`Annotation`](node_modules/ably/ably.d.ts:3255) — full annotation with `id`, `action`, `serial`, `messageSerial`, `type`, `name`, `count`, `data`, `timestamp`, etc.
- [`AnnotationAction`](node_modules/ably/ably.d.ts:3431) — `'annotation.create' | 'annotation.delete'`
- Channel mode [`ANNOTATION_SUBSCRIBE`](node_modules/ably/ably.d.ts:892) — required for subscribing to individual annotation events

---

## 3. Annotation Types & Dynamic Validation

The annotation type string follows the format `namespace:summarization.version` (e.g., `reactions:flag.v1`).

The **summarization method** determines which additional parameters are required:

| Summarization | Required Fields | Notes |
|---------------|----------------|-------|
| `total.v1` | `type` only | Simple count, no client attribution |
| `flag.v1` | `type` only | Per-client flag, requires identified client |
| `distinct.v1` | `type` + `name` | Per-name distinct client tracking |
| `unique.v1` | `type` + `name` | Like distinct but client can only contribute to one name at a time |
| `multiple.v1` | `type` + `name` + `count` | Per-name per-client count tracking |

### Validation Logic

The CLI must parse the `annotationType` argument to extract the summarization method and validate accordingly. The shared validation utility (see Section 6) provides two functions:

- `extractSummarizationType(annotationType)` — parses `"namespace:summarization.version"` and returns the summarization method (e.g., `"distinct"`)
- `validateAnnotationParams(summarization, { name, count, isDelete })` — returns an array of error messages if required params are missing

```typescript
// Usage in publish command:
const summarization = extractSummarizationType(args.annotationType);
const errors = validateAnnotationParams(summarization, { name: flags.name, count: flags.count });
if (errors.length > 0) {
  this.error(errors.join('\n'));
}

// Usage in delete command (isDelete skips count validation):
const summarization = extractSummarizationType(args.annotationType);
const errors = validateAnnotationParams(summarization, { name: flags.name, isDelete: true });
if (errors.length > 0) {
  this.error(errors.join('\n'));
}
```

---

## 4. Architecture & File Structure

### Existing Pattern

The CLI uses [oclif](https://oclif.io/) with a directory-based command structure. Nested commands map to directory hierarchies:

```
src/commands/channels/
├── index.ts              # BaseTopicCommand — "ably channels"
├── publish.ts            # "ably channels publish"
├── subscribe.ts          # "ably channels subscribe"
├── occupancy/
│   ├── get.ts            # "ably channels occupancy get"
│   └── subscribe.ts      # "ably channels occupancy subscribe"
└── presence/
    └── enter.ts          # "ably channels presence enter"
```

### New Files

Following the same pattern, annotations commands will be placed in:

```
src/commands/channels/annotations/
├── index.ts              # BaseTopicCommand — "ably channels annotations"
├── publish.ts            # "ably channels annotations publish"
├── delete.ts             # "ably channels annotations delete"
└── subscribe.ts          # "ably channels annotations subscribe"

test/unit/commands/channels/annotations/
├── publish.test.ts
├── delete.test.ts
└── subscribe.test.ts
```

### Base Class Inheritance

All annotation commands extend [`AblyBaseCommand`](src/base-command.ts:94) which provides:
- [`createAblyRealtimeClient(flags)`](src/base-command.ts:392) — creates authenticated Realtime client
- [`createAblyRestClient(flags)`](src/base-command.ts:365) — creates authenticated REST client
- [`setupConnectionStateLogging()`](src/base-command.ts:1400) — connection state event logging
- [`setupChannelStateLogging()`](src/base-command.ts:1465) — channel state event logging
- [`logCliEvent()`](src/base-command.ts:1099) — structured event logging (verbose/JSON modes)
- [`formatJsonOutput()`](src/base-command.ts:874) — JSON output formatting
- [`shouldOutputJson()`](src/base-command.ts:1179) — check for `--json` / `--pretty-json` flags
- [`setupCleanupHandler()`](src/base-command.ts:1323) — resource cleanup with timeout
- Global flags: `--api-key`, `--token`, `--client-id`, `--json`, `--pretty-json`, `--verbose`, etc.

---

## 5. Command Specifications

### 5.1 `ably channels annotations publish`

**File:** [`src/commands/channels/annotations/publish.ts`](src/commands/channels/annotations/publish.ts)

**Usage:**
```
ably channels annotations publish <channelName> <msgSerial> <annotationType> [flags]
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelName` | `string` | Yes | The channel name (must have annotations enabled) |
| `msgSerial` | `string` | Yes | The serial of the message to annotate |
| `annotationType` | `string` | Yes | Annotation type (e.g., `reactions:flag.v1`) |

**Flags:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name` | `string` | Conditional | Annotation name (required for `distinct`, `unique`, `multiple`) |
| `--count` | `integer` | Conditional | Count value (required for `multiple`) |
| `--data` | `string` | No | Optional data payload (JSON string) |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**Implementation approach:**

```typescript
export default class ChannelsAnnotationsPublish extends AblyBaseCommand {
  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
    msgSerial: Args.string({ description: 'Message serial to annotate', required: true }),
    annotationType: Args.string({ description: 'Annotation type (e.g., reactions:flag.v1)', required: true }),
  };

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    name: Flags.string({ description: 'Annotation name (required for distinct/unique/multiple types)' }),
    count: Flags.integer({ description: 'Count value (required for multiple type)' }),
    data: Flags.string({ description: 'Optional data payload (JSON string)' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsPublish);

    // 1. Extract and validate summarization type
    const summarization = extractSummarizationType(args.annotationType);
    const errors = validateAnnotationParams(summarization, {
      name: flags.name,
      count: flags.count,
    });
    if (errors.length > 0) {
      this.error(errors.join('\n'));
    }

    // 2. Build OutboundAnnotation
    const annotation: Ably.OutboundAnnotation = { type: args.annotationType };
    if (flags.name) annotation.name = flags.name;
    if (flags.count !== undefined) annotation.count = flags.count;
    if (flags.data) {
      try {
        annotation.data = JSON.parse(flags.data);
      } catch {
        this.error('Invalid JSON in --data flag. Please provide valid JSON.');
      }
    }

    // 3. Create Ably Realtime client and publish
    const client = await this.createAblyRealtimeClient(flags);
    if (!client) return;

    const channel = client.channels.get(args.channel);
    await channel.annotations.publish(args.msgSerial, annotation);

    // 4. Output success (JSON or human-readable)
  }
}
```

### 5.2 `ably channels annotations delete`

**File:** [`src/commands/channels/annotations/delete.ts`](src/commands/channels/annotations/delete.ts)

**Usage:**
```
ably channels annotations delete <channelName> <msgSerial> <annotationType> [flags]
```

**Arguments & Flags:** Same as `publish` (minus `--count` since delete doesn't use it).

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name` | `string` | Conditional | Annotation name (required for `distinct`, `unique`, `multiple`) |
| `--data` | `string` | No | Optional data payload (JSON string) |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**Implementation approach:**

```typescript
export default class ChannelsAnnotationsDelete extends AblyBaseCommand {
  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
    msgSerial: Args.string({ description: 'Message serial of the annotated message', required: true }),
    annotationType: Args.string({ description: 'Annotation type (e.g., reactions:flag.v1)', required: true }),
  };

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    name: Flags.string({ description: 'Annotation name (required for distinct/unique/multiple types)' }),
    data: Flags.string({ description: 'Optional data payload (JSON string)' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsDelete);

    // 1. Validate (same as publish, but count not needed for delete via isDelete flag)
    const summarization = extractSummarizationType(args.annotationType);
    const errors = validateAnnotationParams(summarization, {
      name: flags.name,
      isDelete: true,
    });
    if (errors.length > 0) {
      this.error(errors.join('\n'));
    }

    // 2. Build OutboundAnnotation
    const annotation: Ably.OutboundAnnotation = { type: args.annotationType };
    if (flags.name) annotation.name = flags.name;

    // 3. Create client and delete
    const client = await this.createAblyRealtimeClient(flags);
    if (!client) return;

    const channel = client.channels.get(args.channel);
    await channel.annotations.delete(args.msgSerial, annotation);

    // 4. Output success (JSON or human-readable)
  }
}
```

### 5.3 `ably channels annotations subscribe`

**File:** [`src/commands/channels/annotations/subscribe.ts`](src/commands/channels/annotations/subscribe.ts)

**Usage:**
```
ably channels annotations subscribe <channelName> [flags]
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelName` | `string` | Yes | The channel name to subscribe to annotation events |

**Flags:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--duration` | `integer` | No | Auto-exit after N seconds (0 = indefinite) |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**Implementation approach:**

This is a long-running command that listens for `annotation.create` and `annotation.delete` events. It follows the same pattern as [`channels subscribe`](src/commands/channels/subscribe.ts) and [`channels occupancy subscribe`](src/commands/channels/occupancy/subscribe.ts).

```typescript
export default class ChannelsAnnotationsSubscribe extends AblyBaseCommand {
  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
  };

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    duration: Flags.integer({
      description: 'Auto-exit after N seconds (0 = indefinite)',
      char: 'D',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsSubscribe);

    // 1. Create Realtime client
    const client = await this.createAblyRealtimeClient(flags);
    if (!client) return;

    // 2. Get channel with ANNOTATION_SUBSCRIBE mode
    const channel = client.channels.get(args.channel, {
      modes: ['ANNOTATION_SUBSCRIBE'],
    });

    // 3. Setup connection & channel state logging
    this.setupConnectionStateLogging(client, flags, { includeUserFriendlyMessages: true });
    this.setupChannelStateLogging(channel, flags, { includeUserFriendlyMessages: true });

    // 4. Subscribe to annotations
    await channel.annotations.subscribe((annotation: Ably.Annotation) => {
      const timestamp = annotation.timestamp
        ? new Date(annotation.timestamp).toISOString()
        : new Date().toISOString();

      const event = {
        action: annotation.action,       // 'annotation.create' or 'annotation.delete'
        channel: args.channel,
        clientId: annotation.clientId,
        count: annotation.count,
        data: annotation.data,
        messageSerial: annotation.messageSerial,
        name: annotation.name,
        serial: annotation.serial,
        timestamp,
        type: annotation.type,
      };

      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput(event, flags));
      } else {
        // Human-readable output
        const actionLabel = annotation.action === 'annotation.create'
          ? chalk.green('CREATE')
          : chalk.red('DELETE');
        this.log(`[${timestamp}] ${actionLabel} | Type: ${annotation.type} | Name: ${annotation.name || '(none)'} | Client: ${annotation.clientId || '(none)'}`);
        if (annotation.data) {
          this.log(`  Data: ${JSON.stringify(annotation.data)}`);
        }
        this.log('');
      }
    });

    // 5. Wait until interrupted or timeout
    await waitUntilInterruptedOrTimeout(flags.duration);
  }
}
```

### 5.4 `ably channels annotations` (Index/Topic)

**File:** [`src/commands/channels/annotations/index.ts`](src/commands/channels/annotations/index.ts)

This is the topic command that lists available annotation subcommands when run without arguments.

```typescript
import { BaseTopicCommand } from '../../../base-topic-command.js';

export default class ChannelsAnnotations extends BaseTopicCommand {
  protected topicName = 'channels:annotations';
  protected commandGroup = 'Channel annotations';

  static override description = 'Manage annotations on Ably channel messages';

  static override examples = [
    "<%= config.bin %> <%= command.id %> publish my-channel msg-serial-123 reactions:flag.v1",
    "<%= config.bin %> <%= command.id %> delete my-channel msg-serial-123 reactions:flag.v1",
    "<%= config.bin %> <%= command.id %> subscribe my-channel",
  ];
}
```

---

## 6. Shared Validation Utility

To avoid code duplication between `publish` and `delete`, extract the validation logic into a shared utility:

**File:** [`src/commands/channels/annotations/validation.ts`](src/commands/channels/annotations/validation.ts)

```typescript
/**
 * Extract the summarization method from an annotation type string.
 * Format: "namespace:summarization.version" → returns "summarization"
 */
export function extractSummarizationType(annotationType: string): string {
  const colonIndex = annotationType.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(
      'Invalid annotation type format. Expected "namespace:summarization.version" (e.g., "reactions:flag.v1")'
    );
  }
  const summarizationPart = annotationType.slice(colonIndex + 1);
  const dotIndex = summarizationPart.indexOf('.');
  if (dotIndex === -1) {
    throw new Error(
      'Invalid annotation type format. Expected "namespace:summarization.version" (e.g., "reactions:flag.v1")'
    );
  }
  return summarizationPart.slice(0, dotIndex);
}

/** Summarization types that require a `name` parameter */
const NAME_REQUIRED_TYPES = ['distinct', 'unique', 'multiple'];

/** Summarization types that require a `count` parameter */
const COUNT_REQUIRED_TYPES = ['multiple'];

/**
 * Validate that the required parameters are present for the given summarization type.
 */
export function validateAnnotationParams(
  summarization: string,
  options: { name?: string; count?: number; isDelete?: boolean },
): string[] {
  const errors: string[] = [];

  if (NAME_REQUIRED_TYPES.includes(summarization) && !options.name) {
    errors.push(`--name is required for "${summarization}" annotation types`);
  }

  // count is only required for publish, not delete
  if (!options.isDelete && COUNT_REQUIRED_TYPES.includes(summarization) && options.count === undefined) {
    errors.push(`--count is required for "${summarization}" annotation types`);
  }

  return errors;
}
```

---

## 7. Mock Updates for Testing

The existing [`MockRealtimeChannel`](test/helpers/mock-ably-realtime.ts:33) interface needs to be extended to include an `annotations` property:

### Changes to [`test/helpers/mock-ably-realtime.ts`](test/helpers/mock-ably-realtime.ts)

```typescript
// Add new interface
export interface MockAnnotations {
  publish: Mock;
  delete: Mock;
  subscribe: Mock;
  unsubscribe: Mock;
  get: Mock;
  _emitter: AblyEventEmitter;
  _emit: (annotation: Ably.Annotation) => void;
}

// Update MockRealtimeChannel to include annotations
export interface MockRealtimeChannel {
  // ... existing fields ...
  annotations: MockAnnotations;
}
```

Add a `createMockAnnotations()` factory function following the same pattern as [`createMockPresence()`](test/helpers/mock-ably-realtime.ts:131):

```typescript
function createMockAnnotations(): MockAnnotations {
  const emitter = new EventEmitter();

  const annotations: MockAnnotations = {
    publish: vi.fn().mockImplementation(async () => {}),
    delete: vi.fn().mockImplementation(async () => {}),
    subscribe: vi.fn((typeOrCallback, callback?) => {
      const cb = callback ?? typeOrCallback;
      const event = callback ? typeOrCallback : null;
      emitter.on(event, cb);
    }),
    unsubscribe: vi.fn((typeOrCallback?, callback?) => {
      if (!typeOrCallback) {
        emitter.off();
      } else if (typeof typeOrCallback === 'function') {
        emitter.off(null, typeOrCallback);
      } else if (callback) {
        emitter.off(typeOrCallback, callback);
      }
    }),
    get: vi.fn().mockResolvedValue({ items: [] }),
    _emitter: emitter,
    _emit: (annotation) => {
      emitter.emit(annotation.action || '', annotation);
    },
  };

  return annotations;
}
```

Then add `annotations: createMockAnnotations()` to the [`createMockChannel()`](test/helpers/mock-ably-realtime.ts:177) function.

---

## 8. Test Plan

### Unit Tests

Each command gets a dedicated test file following the pattern in [`test/unit/commands/channels/publish.test.ts`](test/unit/commands/channels/publish.test.ts):

#### [`test/unit/commands/channels/annotations/publish.test.ts`](test/unit/commands/channels/annotations/publish.test.ts)

| Test Case | Description |
|-----------|-------------|
| Publish with `total.v1` type | Verify publish with only `type` arg succeeds |
| Publish with `flag.v1` type | Verify publish with only `type` arg succeeds |
| Publish with `distinct.v1` + `--name` | Verify publish with `name` flag succeeds |
| Publish with `unique.v1` + `--name` | Verify publish with `name` flag succeeds |
| Publish with `multiple.v1` + `--name` + `--count` | Verify publish with both flags succeeds |
| Missing `--name` for `distinct.v1` | Verify validation error |
| Missing `--count` for `multiple.v1` | Verify validation error |
| Invalid annotation type format | Verify format validation error |
| JSON output mode | Verify structured JSON output |
| API error handling | Verify error propagation |
| With `--data` flag | Verify data payload is included |

#### [`test/unit/commands/channels/annotations/delete.test.ts`](test/unit/commands/channels/annotations/delete.test.ts)

| Test Case | Description |
|-----------|-------------|
| Delete with `flag.v1` type | Verify delete with only `type` arg succeeds |
| Delete with `distinct.v1` + `--name` | Verify delete with `name` flag succeeds |
| Missing `--name` for `unique.v1` | Verify validation error |
| JSON output mode | Verify structured JSON output |
| API error handling | Verify error propagation |

#### [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts)

| Test Case | Description |
|-----------|-------------|
| Subscribe to channel | Verify `channel.annotations.subscribe()` is called |
| Receive `annotation.create` event | Verify create event is displayed |
| Receive `annotation.delete` event | Verify delete event is displayed |
| JSON output mode | Verify structured JSON output for events |
| Channel with `ANNOTATION_SUBSCRIBE` mode | Verify channel mode is set correctly |
| Duration flag | Verify auto-exit after timeout |

#### [`test/unit/commands/channels/annotations/validation.test.ts`](test/unit/commands/channels/annotations/validation.test.ts)

| Test Case | Description |
|-----------|-------------|
| Parse valid annotation types | Various valid formats |
| Reject invalid formats | Missing colon, missing dot, etc. |
| Validate `total.v1` params | No extra params needed |
| Validate `distinct.v1` params | Name required |
| Validate `multiple.v1` params | Name + count required |
| Unknown summarization type | Should pass (forward compatibility) |

---

## 9. Integration Steps

### Step-by-step implementation order:

1. **Create shared validation utility**
   - [`src/commands/channels/annotations/validation.ts`](src/commands/channels/annotations/validation.ts)

2. **Create topic index command**
   - [`src/commands/channels/annotations/index.ts`](src/commands/channels/annotations/index.ts)

3. **Create `publish` command**
   - [`src/commands/channels/annotations/publish.ts`](src/commands/channels/annotations/publish.ts)

4. **Create `delete` command**
   - [`src/commands/channels/annotations/delete.ts`](src/commands/channels/annotations/delete.ts)

5. **Create `subscribe` command**
   - [`src/commands/channels/annotations/subscribe.ts`](src/commands/channels/annotations/subscribe.ts)

6. **Update mock helpers**
   - Add `MockAnnotations` to [`test/helpers/mock-ably-realtime.ts`](test/helpers/mock-ably-realtime.ts)
   - Add `annotations` property to mock channels

7. **Write unit tests**
   - [`test/unit/commands/channels/annotations/publish.test.ts`](test/unit/commands/channels/annotations/publish.test.ts)
   - [`test/unit/commands/channels/annotations/delete.test.ts`](test/unit/commands/channels/annotations/delete.test.ts)
   - [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts)
   - [`test/unit/commands/channels/annotations/validation.test.ts`](test/unit/commands/channels/annotations/validation.test.ts)

8. **Run mandatory workflow**
   ```bash
   pnpm prepare        # Build + update manifest/README
   pnpm exec eslint .  # Lint (must be 0 errors)
   pnpm test:unit      # Run unit tests
   ```

---

## 10. Output Format Examples

### Publish — Human-readable

```
✓ Annotation published successfully.
  Channel: my-channel
  Message Serial: 01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800000-0
  Type: reactions:flag.v1
```

### Publish — JSON (`--json`)

```json
{
  "success": true,
  "channel": "my-channel",
  "messageSerial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800000-0",
  "annotationType": "reactions:flag.v1",
  "name": null,
  "count": null
}
```

### Subscribe — Human-readable

```
✓ Subscribed to annotations on channel: my-channel. Listening for events...

[2026-03-05T09:00:00.000Z] CREATE | Type: reactions:flag.v1 | Name: (none) | Client: user-123

[2026-03-05T09:00:05.000Z] DELETE | Type: reactions:flag.v1 | Name: (none) | Client: user-123
```

### Subscribe — JSON (`--json`)

```json
{
  "action": "annotation.create",
  "channel": "my-channel",
  "type": "reactions:flag.v1",
  "name": null,
  "clientId": "user-123",
  "messageSerial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800000-0",
  "serial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800001-0",
  "count": null,
  "data": null,
  "timestamp": "2026-03-05T09:00:00.000Z"
}
```

### Validation Error

```
Error: --name is required for "distinct" annotation types.

Usage:
  ably channels annotations publish <channelName> <msgSerial> <annotationType> [--name <name>]

Annotation types that require --name: distinct.v1, unique.v1, multiple.v1
Annotation types that require --count: multiple.v1
```

---

## 11. Edge Cases & Considerations

1. **Forward compatibility**: Unknown summarization types should be allowed (no validation error) since new types may be added server-side.

2. **Client ID requirement**: `flag.v1`, `distinct.v1`, and `unique.v1` require identified clients. The CLI auto-generates a `clientId` via [`setClientId()`](src/base-command.ts:1303) unless `--client-id none` is specified. A warning should be shown if `--client-id none` is used with these types.

3. **Channel mode for subscribe**: The subscribe command must request `ANNOTATION_SUBSCRIBE` mode via [`ChannelOptions.modes`](node_modules/ably/ably.d.ts:892). This is distinct from regular message subscription.

4. **Data payload parsing**: The `--data` flag accepts a JSON string. Invalid JSON should produce a clear error message.

5. **REST vs Realtime transport**: The SDK's `annotations.publish()` and `annotations.delete()` are available on both REST and Realtime channels. For simplicity, the CLI will use Realtime by default (consistent with other channel commands). A `--transport` flag could be added later if needed.

6. **Web CLI mode**: Annotations commands should work in web CLI mode since they are data-plane operations, similar to existing channel commands.

---

## 12. Dependencies

- **No new npm dependencies required** — the `ably@^2.14.0` SDK already includes full annotations support.
- **No changes to [`src/services/control-api.ts`](src/services/control-api.ts)** — annotations use the product API (Realtime/REST), not the Control API.
- **No changes to [`src/base-command.ts`](src/base-command.ts)** — all needed utilities are already available.

---

## 13. Summary of Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/commands/channels/annotations/index.ts` | Topic command (lists subcommands) |
| `src/commands/channels/annotations/publish.ts` | Publish annotation command |
| `src/commands/channels/annotations/delete.ts` | Delete annotation command |
| `src/commands/channels/annotations/subscribe.ts` | Subscribe to annotation events command |
| `src/commands/channels/annotations/validation.ts` | Shared validation utility |
| `test/unit/commands/channels/annotations/publish.test.ts` | Publish unit tests |
| `test/unit/commands/channels/annotations/delete.test.ts` | Delete unit tests |
| `test/unit/commands/channels/annotations/subscribe.test.ts` | Subscribe unit tests |
| `test/unit/commands/channels/annotations/validation.test.ts` | Validation unit tests |

### Modified Files

| File | Change |
|------|--------|
| `test/helpers/mock-ably-realtime.ts` | Add `MockAnnotations` interface and `annotations` property to mock channels |
