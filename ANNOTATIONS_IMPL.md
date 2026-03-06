# Channels Annotations — Implementation Plan

## 1. Feature Overview

This document describes the implementation approach for adding **Message Annotations** support to the Ably CLI. Annotations allow clients to append metadata (reactions, tags, read receipts, etc.) to existing messages on a channel.

**Reference documentation:** [https://ably.com/docs/messages/annotations.md](https://ably.com/docs/messages/annotations.md)

### New CLI Commands

```
ably channels annotations publish <channelName> <msgSerial> <annotationType>
ably channels annotations delete <channelName> <msgSerial> <annotationType>
ably channels annotations get <channelName> <msgSerial>
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
| [`channel.annotations.subscribe(type, listener)`](node_modules/ably/ably.d.ts:2132) | Subscribe to annotation events filtered by type |
| [`channel.annotations.unsubscribe(listener)`](node_modules/ably/ably.d.ts:2159) | Deregister a specific annotation listener |
| [`channel.annotations.unsubscribe()`](node_modules/ably/ably.d.ts:2163) | Deregister all annotation listeners |
| [`channel.annotations.get(messageSerial, params)`](node_modules/ably/ably.d.ts:2216) | Get annotations for a message (paginated) |

> **Note on `delete`:** The TypeScript declaration file ([`ably.d.ts`](node_modules/ably/ably.d.ts)) only exposes `delete` on [`RealtimeAnnotations`](node_modules/ably/ably.d.ts:2201), not on [`RestAnnotations`](node_modules/ably/ably.d.ts:2834). However, the runtime source code in [`restannotations.ts`](node_modules/ably/src/common/lib/client/restannotations.ts:96) **does** implement `delete` by delegating to `publish` with `action = 'annotation.delete'`. The same pattern is used in [`realtimeannotations.ts`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:51). For the CLI, we use the Realtime client for `publish` and `delete` (consistent with other channel commands), and the REST client for `get`.

### Key Types

- [`OutboundAnnotation`](node_modules/ably/ably.d.ts:3316) — `Partial<Annotation> & { type: string }` — used for publish/delete
- [`Annotation`](node_modules/ably/ably.d.ts:3255) — full annotation with fields:
  - `id: string` — unique ID assigned by Ably
  - `clientId?: string` — publisher's client ID
  - `name?: string` — annotation name (used by most aggregation types)
  - `count?: number` — optional count (for `multiple.v1`)
  - `data?: any` — arbitrary publisher-provided payload
  - `encoding?: string` — encoding of the payload
  - `timestamp: number` — when annotation was received by Ably (ms since Unix epoch)
  - `action: AnnotationAction` — `'annotation.create'` or `'annotation.delete'`
  - `serial: string` — this annotation's unique serial
  - `messageSerial: string` — serial of the message being annotated
  - `type: string` — annotation type (e.g., `"emoji:distinct.v1"`)
  - `extras: any` — JSON object for metadata/ancillary payloads
- [`AnnotationAction`](node_modules/ably/ably.d.ts:3431) — `'annotation.create' | 'annotation.delete'`
- [`GetAnnotationsParams`](node_modules/ably/ably.d.ts:1036) — `{ limit?: number }` (default 100, max 1000)
- [`PaginatedResult<Annotation>`](node_modules/ably/ably.d.ts:3674) — paginated result with `items: Annotation[]`, `hasNext()`, `next()`, `first()`, `current()`, `isLast()`
- Channel mode [`ANNOTATION_PUBLISH`](node_modules/ably/ably.d.ts:890) — required for publishing annotations
- Channel mode [`ANNOTATION_SUBSCRIBE`](node_modules/ably/ably.d.ts:894) — required for subscribing to individual annotation events

### SDK Internal Details (from source code review)

- [`RestAnnotations.delete()`](node_modules/ably/src/common/lib/client/restannotations.ts:96) sets `action = 'annotation.delete'` then delegates to `publish()`
- [`RealtimeAnnotations.delete()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:51) same pattern — sets `action = 'annotation.delete'` then delegates to `publish()`
- [`RealtimeAnnotations.get()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:95) delegates to `RestAnnotations.prototype.get` (REST call under the hood)
- [`RealtimeAnnotations._processIncoming()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:89) emits on `annotation.type` (not `annotation.action`), so `subscribe(type, listener)` filters by annotation type string
- [`RealtimeAnnotations.subscribe()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:56) checks for `ANNOTATION_SUBSCRIBE` channel mode flag and throws `ErrorInfo(93001)` if not set
- Annotations are **not encrypted** — data needs to be parsed by the server for summarisation (see [`annotation.ts:69`](node_modules/ably/src/common/lib/types/annotation.ts:69))

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
├── history.ts            # "ably channels history"
├── occupancy/
│   ├── get.ts            # "ably channels occupancy get"
│   └── subscribe.ts      # "ably channels occupancy subscribe"
└── presence/
    ├── enter.ts          # "ably channels presence enter"
    └── subscribe.ts      # "ably channels presence subscribe"
```

### New Files

Following the same pattern, annotations commands will be placed in:

```
src/commands/channels/annotations/
├── index.ts              # BaseTopicCommand — "ably channels annotations"
├── publish.ts            # "ably channels annotations publish"
├── delete.ts             # "ably channels annotations delete"
├── get.ts                # "ably channels annotations get"
├── subscribe.ts          # "ably channels annotations subscribe"
└── validation.ts         # Shared validation utility

test/unit/commands/channels/annotations/
├── publish.test.ts
├── delete.test.ts
├── get.test.ts
├── subscribe.test.ts
└── validation.test.ts
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
- [`jsonError()`](src/base-command.ts) — emit structured JSON error

### Flag Architecture

Per the project's flag conventions in [`src/flags.ts`](src/flags.ts), commands must use composable flag sets:

- **`productApiFlags`** — core global flags + hidden product API flags (for all annotation commands)
- **`clientIdFlag`** — `--client-id` flag (for `publish`, `delete`, and `subscribe` since they create realtime connections)
- **`timeRangeFlags`** — not needed for annotations (annotations don't have time-range queries)

Output helpers from [`src/utils/output.ts`](src/utils/output.ts):
- `progress(message)` — progress indicator (appends `...` automatically)
- `success(message)` — green ✓ success message (must end with `.`)
- `listening(description)` — dim listening message with "Press Ctrl+C to exit."
- `resource(name)` — cyan resource name (never quoted)
- `formatTimestamp(ts)` — dim `[timestamp]` for event streams

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
| `--client-id` | `string` | No | Override default client ID |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**Implementation approach:**

```typescript
import { Args, Flags } from '@oclif/core';
import * as Ably from 'ably';

import { AblyBaseCommand } from '../../../base-command.js';
import { clientIdFlag, productApiFlags } from '../../../flags.js';
import { resource, success } from '../../../utils/output.js';
import { extractSummarizationType, validateAnnotationParams } from './validation.js';

export default class ChannelsAnnotationsPublish extends AblyBaseCommand {
  static override description = 'Publish an annotation on a message';

  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
    msgSerial: Args.string({ description: 'Message serial to annotate', required: true }),
    annotationType: Args.string({ description: 'Annotation type (e.g., reactions:flag.v1)', required: true }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({ description: 'Annotation name (required for distinct/unique/multiple types)' }),
    count: Flags.integer({ description: 'Count value (required for multiple type)' }),
    data: Flags.string({ description: 'Optional data payload (JSON string)' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsPublish);

    try {
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

      // 4. Output success
      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput({
          success: true,
          channel: args.channel,
          messageSerial: args.msgSerial,
          annotationType: args.annotationType,
          name: flags.name || null,
          count: flags.count ?? null,
        }, flags));
      } else {
        this.log(success(`Annotation published to channel ${resource(args.channel)}.`));
      }
    } catch (error) {
      const errorMsg = `Error publishing annotation: ${error instanceof Error ? error.message : String(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
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
| `--client-id` | `string` | No | Override default client ID |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**Implementation approach:**

```typescript
import { Args, Flags } from '@oclif/core';
import * as Ably from 'ably';

import { AblyBaseCommand } from '../../../base-command.js';
import { clientIdFlag, productApiFlags } from '../../../flags.js';
import { resource, success } from '../../../utils/output.js';
import { extractSummarizationType, validateAnnotationParams } from './validation.js';

export default class ChannelsAnnotationsDelete extends AblyBaseCommand {
  static override description = 'Delete an annotation from a message';

  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
    msgSerial: Args.string({ description: 'Message serial of the annotated message', required: true }),
    annotationType: Args.string({ description: 'Annotation type (e.g., reactions:flag.v1)', required: true }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({ description: 'Annotation name (required for distinct/unique/multiple types)' }),
    data: Flags.string({ description: 'Optional data payload (JSON string)' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsDelete);

    try {
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
      if (flags.data) {
        try {
          annotation.data = JSON.parse(flags.data);
        } catch {
          this.error('Invalid JSON in --data flag. Please provide valid JSON.');
        }
      }

      // 3. Create client and delete
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      const channel = client.channels.get(args.channel);
      await channel.annotations.delete(args.msgSerial, annotation);

      // 4. Output success
      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput({
          success: true,
          channel: args.channel,
          messageSerial: args.msgSerial,
          annotationType: args.annotationType,
          name: flags.name || null,
        }, flags));
      } else {
        this.log(success(`Annotation deleted from channel ${resource(args.channel)}.`));
      }
    } catch (error) {
      const errorMsg = `Error deleting annotation: ${error instanceof Error ? error.message : String(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
```

### 5.3 `ably channels annotations get`

**File:** [`src/commands/channels/annotations/get.ts`](src/commands/channels/annotations/get.ts)

**Usage:**
```
ably channels annotations get <channelName> <msgSerial> [flags]
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `channelName` | `string` | Yes | The channel name |
| `msgSerial` | `string` | Yes | The serial of the message to get annotations for |

**Flags:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--limit` | `integer` | No | Maximum number of results to return (default: 100, max: 1000) |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**SDK method:** [`channel.annotations.get(messageSerial, params)`](node_modules/ably/ably.d.ts:2216) returns `Promise<PaginatedResult<Annotation>>`.

The [`GetAnnotationsParams`](node_modules/ably/ably.d.ts:1036) interface only has one field:
- `limit?: number` — upper limit on annotations returned (default: 100, max: 1000)

**Implementation approach:**

This is a REST-style paginated query, similar to [`channels history`](src/commands/channels/history.ts). It uses a REST client since `annotations.get()` is a REST call under the hood (even on Realtime, it delegates to [`RestAnnotations.prototype.get`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:99)).

```typescript
import { Args, Flags } from '@oclif/core';
import * as Ably from 'ably';
import chalk from 'chalk';

import { AblyBaseCommand } from '../../../base-command.js';
import { productApiFlags } from '../../../flags.js';
import { formatTimestamp, resource } from '../../../utils/output.js';

export default class ChannelsAnnotationsGet extends AblyBaseCommand {
  static override description = 'Get annotations for a message';

  static override examples = [
    '$ ably channels annotations get my-channel msg-serial-123',
    '$ ably channels annotations get my-channel msg-serial-123 --limit 50',
    '$ ably channels annotations get my-channel msg-serial-123 --json',
  ];

  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
    msgSerial: Args.string({ description: 'Message serial to get annotations for', required: true }),
  };

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: 'Maximum number of results to return (default: 100)',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsGet);

    try {
      // 1. Create REST client (get is a REST operation)
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      // 2. Get channel and fetch annotations
      const channel = client.channels.get(args.channel);
      const params: Ably.GetAnnotationsParams = {};
      if (flags.limit !== undefined) {
        params.limit = flags.limit;
      }

      const result = await channel.annotations.get(args.msgSerial, params);
      const annotations = result.items;

      // 3. Output results
      if (this.shouldOutputJson(flags)) {
        this.log(this.formatJsonOutput(annotations.map((annotation, index) => ({
          index: index + 1,
          id: annotation.id,
          action: annotation.action,
          type: annotation.type,
          name: annotation.name || null,
          clientId: annotation.clientId || null,
          count: annotation.count ?? null,
          data: annotation.data ?? null,
          messageSerial: annotation.messageSerial,
          serial: annotation.serial,
          timestamp: annotation.timestamp
            ? new Date(annotation.timestamp).toISOString()
            : null,
        })), flags));
      } else {
        if (annotations.length === 0) {
          this.log(`No annotations found for message ${resource(args.msgSerial)} on channel ${resource(args.channel)}.`);
          return;
        }

        this.log(`Annotations for message ${resource(args.msgSerial)} on channel ${resource(args.channel)}:\n`);

        for (const [index, annotation] of annotations.entries()) {
          const timestamp = annotation.timestamp
            ? new Date(annotation.timestamp).toISOString()
            : new Date().toISOString();

          const actionLabel = annotation.action === 'annotation.create'
            ? chalk.green('CREATE')
            : chalk.red('DELETE');

          this.log(`${chalk.dim(`[${index + 1}]`)} ${formatTimestamp(timestamp)} ${actionLabel} | ${chalk.dim('Type:')} ${annotation.type} | ${chalk.dim('Name:')} ${annotation.name || '(none)'} | ${chalk.dim('Client:')} ${annotation.clientId ? chalk.blue(annotation.clientId) : '(none)'}`);
          if (annotation.count !== undefined) {
            this.log(`    ${chalk.dim('Count:')} ${annotation.count}`);
          }
          if (annotation.data) {
            this.log(`    ${chalk.dim('Data:')} ${JSON.stringify(annotation.data)}`);
          }
        }

        if (annotations.length === flags.limit) {
          this.log('');
          this.log(chalk.yellow(`Showing maximum of ${flags.limit} annotations. Use --limit to show more.`));
        }
      }
    } catch (error) {
      const errorMsg = `Error retrieving annotations: ${error instanceof Error ? error.message : String(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
```

### 5.4 `ably channels annotations subscribe`

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
| `--duration` | `integer` | No | Automatically exit after N seconds |
| `--client-id` | `string` | No | Override default client ID |
| `--json` | `boolean` | No | Output in JSON format |
| `--pretty-json` | `boolean` | No | Output in colorized JSON format |

**Implementation approach:**

This is a long-running command that listens for annotation events. It follows the same pattern as [`channels subscribe`](src/commands/channels/subscribe.ts) and [`channels occupancy subscribe`](src/commands/channels/occupancy/subscribe.ts).

**Important SDK detail:** The SDK's [`_processIncoming()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:89) emits events keyed by `annotation.type` (not `annotation.action`). When calling `subscribe(listener)` without a type filter, the listener receives all annotation events regardless of type.

The subscribe command **must auto-unsubscribe on cleanup** (per improvement notes). When the command exits (via Ctrl+C or `--duration` timeout), it should call `channel.annotations.unsubscribe()` to clean up listeners.

```typescript
import { Args, Flags } from '@oclif/core';
import * as Ably from 'ably';
import chalk from 'chalk';

import { AblyBaseCommand } from '../../../base-command.js';
import { clientIdFlag, productApiFlags } from '../../../flags.js';
import { waitUntilInterruptedOrTimeout } from '../../../utils/long-running.js';
import {
  formatTimestamp,
  listening,
  progress,
  resource,
  success,
} from '../../../utils/output.js';

export default class ChannelsAnnotationsSubscribe extends AblyBaseCommand {
  static override description = 'Subscribe to annotation events on a channel';

  static override args = {
    channel: Args.string({ description: 'Channel name', required: true }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    duration: Flags.integer({
      description: 'Automatically exit after N seconds',
      char: 'D',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsSubscribe);

    try {
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

      if (!this.shouldOutputJson(flags)) {
        this.log(progress(`Attaching to channel: ${resource(args.channel)}`));
      }

      // 4. Subscribe to annotations
      await channel.annotations.subscribe((annotation: Ably.Annotation) => {
        const timestamp = annotation.timestamp
          ? new Date(annotation.timestamp).toISOString()
          : new Date().toISOString();

        const event = {
          action: annotation.action,       // 'annotation.create' or 'annotation.delete'
          channel: args.channel,
          clientId: annotation.clientId || null,
          count: annotation.count ?? null,
          data: annotation.data ?? null,
          messageSerial: annotation.messageSerial,
          name: annotation.name || null,
          serial: annotation.serial,
          timestamp,
          type: annotation.type,
        };

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(event, flags));
        } else {
          // Human-readable output using project output helpers
          const actionLabel = annotation.action === 'annotation.create'
            ? chalk.green('CREATE')
            : chalk.red('DELETE');
          this.log(`${formatTimestamp(timestamp)} ${actionLabel} | ${chalk.dim('Type:')} ${annotation.type} | ${chalk.dim('Name:')} ${annotation.name || '(none)'} | ${chalk.dim('Client:')} ${annotation.clientId ? chalk.blue(annotation.clientId) : '(none)'}`);
          if (annotation.data) {
            this.log(`  ${chalk.dim('Data:')} ${JSON.stringify(annotation.data)}`);
          }
          this.log('');
        }
      });

      // 5. Show success message
      if (!this.shouldOutputJson(flags)) {
        this.log(success(`Subscribed to annotations on channel ${resource(args.channel)}.`));
        this.log(listening('Listening for annotation events.'));
        this.log('');
      }

      // 6. Wait until interrupted or timeout
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);

      // 7. Auto-unsubscribe on cleanup
      channel.annotations.unsubscribe();
      this.logCliEvent(flags, 'annotations:subscribe', 'cleanup', 'Unsubscribed from annotations', {
        exitReason,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(`Error: ${errorMsg}`);
      }
    }
  }
}
```

### 5.5 `ably channels annotations` (Index/Topic)

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
    "<%= config.bin %> <%= command.id %> get my-channel msg-serial-123",
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
    get: vi.fn().mockResolvedValue({ items: [], hasNext: () => false, isLast: () => true }),
    _emitter: emitter,
    // Note: SDK emits on annotation.type, not annotation.action
    _emit: (annotation) => {
      emitter.emit(annotation.type || '', annotation);
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

#### [`test/unit/commands/channels/annotations/get.test.ts`](test/unit/commands/channels/annotations/get.test.ts)

| Test Case | Description |
|-----------|-------------|
| Get annotations with default limit | Verify `channel.annotations.get()` is called with `{ limit: 100 }` |
| Get annotations with custom `--limit` | Verify limit param is passed correctly |
| Empty result set | Verify "No annotations found" message |
| Multiple annotations returned | Verify all annotations are displayed |
| JSON output mode | Verify structured JSON output with all annotation fields |
| API error handling | Verify error propagation |
| Limit hint message | Verify hint shown when result count equals limit |

#### [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts)

| Test Case | Description |
|-----------|-------------|
| Subscribe to channel | Verify `channel.annotations.subscribe()` is called |
| Receive `annotation.create` event | Verify create event is displayed |
| Receive `annotation.delete` event | Verify delete event is displayed |
| JSON output mode | Verify structured JSON output for events |
| Channel with `ANNOTATION_SUBSCRIBE` mode | Verify channel mode is set correctly |
| Duration flag | Verify auto-exit after timeout |
| Auto-unsubscribe on cleanup | Verify `channel.annotations.unsubscribe()` is called on exit |

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

5. **Create `get` command**
   - [`src/commands/channels/annotations/get.ts`](src/commands/channels/annotations/get.ts)

6. **Create `subscribe` command**
   - [`src/commands/channels/annotations/subscribe.ts`](src/commands/channels/annotations/subscribe.ts)

7. **Update mock helpers**
   - Add `MockAnnotations` to [`test/helpers/mock-ably-realtime.ts`](test/helpers/mock-ably-realtime.ts)
   - Add `annotations` property to mock channels

8. **Write unit tests**
   - [`test/unit/commands/channels/annotations/publish.test.ts`](test/unit/commands/channels/annotations/publish.test.ts)
   - [`test/unit/commands/channels/annotations/delete.test.ts`](test/unit/commands/channels/annotations/delete.test.ts)
   - [`test/unit/commands/channels/annotations/get.test.ts`](test/unit/commands/channels/annotations/get.test.ts)
   - [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts)
   - [`test/unit/commands/channels/annotations/validation.test.ts`](test/unit/commands/channels/annotations/validation.test.ts)

9. **Run mandatory workflow**
   ```bash
   pnpm prepare        # Build + update manifest/README
   pnpm exec eslint .  # Lint (must be 0 errors)
   pnpm test:unit      # Run unit tests
   ```

---

## 10. Output Format Examples

### Publish — Human-readable

```
✓ Annotation published to channel my-channel.
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

### Delete — Human-readable

```
✓ Annotation deleted from channel my-channel.
```

### Get — Human-readable

```
Annotations for message 01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800000-0 on channel my-channel:

[1] [2026-03-05T09:00:00.000Z] CREATE | Type: reactions:flag.v1 | Name: (none) | Client: user-123
[2] [2026-03-05T09:00:01.000Z] CREATE | Type: reactions:distinct.v1 | Name: thumbsup | Client: user-456
    Data: {"emoji": "👍"}
```

### Get — JSON (`--json`)

```json
[
  {
    "index": 1,
    "id": "ann-001",
    "action": "annotation.create",
    "type": "reactions:flag.v1",
    "name": null,
    "clientId": "user-123",
    "count": null,
    "data": null,
    "messageSerial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800000-0",
    "serial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800001-0",
    "timestamp": "2026-03-05T09:00:00.000Z"
  }
]
```

### Subscribe — Human-readable

```
Attaching to channel: my-channel...
✓ Subscribed to annotations on channel my-channel.
Listening for annotation events. Press Ctrl+C to exit.

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

3. **Channel mode for subscribe**: The subscribe command must request `ANNOTATION_SUBSCRIBE` mode via [`ChannelOptions.modes`](node_modules/ably/ably.d.ts:894). This is distinct from regular message subscription. The SDK will throw `ErrorInfo(93001)` if you try to subscribe without this mode.

4. **Data payload parsing**: The `--data` flag accepts a JSON string. Invalid JSON should produce a clear error message.

5. **REST vs Realtime transport**: Both `RestAnnotations` and `RealtimeAnnotations` support `publish`, `delete`, and `get`. The `delete` method delegates to `publish` with `action = 'annotation.delete'` in both cases (see [`restannotations.ts:96`](node_modules/ably/src/common/lib/client/restannotations.ts:96) and [`realtimeannotations.ts:51`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:51)). The `get` method on Realtime delegates to `RestAnnotations.prototype.get` (see [`realtimeannotations.ts:99`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:99)). For the CLI:
   - `publish` and `delete` → use **Realtime** client (consistent with other channel commands)
   - `get` → use **REST** client (it's a REST call, similar to `channels history`)
   - `subscribe` → use **Realtime** client (requires persistent connection)

6. **Annotations are not encrypted**: The SDK does not encrypt annotation data (see [`annotation.ts:69`](node_modules/ably/src/common/lib/types/annotation.ts:69)) because the server needs to parse data for summarisation. No `--cipher-key` flag is needed.

7. **Subscribe event emission**: The SDK emits annotation events keyed by `annotation.type` (not `annotation.action`). See [`_processIncoming()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:89): `this.subscriptions.emit(annotation.type || '', annotation)`. This means `subscribe(type, listener)` filters by annotation type string, while `subscribe(listener)` receives all.

8. **Auto-unsubscribe on cleanup**: The subscribe command must call `channel.annotations.unsubscribe()` when exiting to clean up listeners properly.

9. **Web CLI mode**: Annotations commands should work in web CLI mode since they are data-plane operations, similar to existing channel commands.

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
| `src/commands/channels/annotations/get.ts` | Get annotations for a message (paginated) |
| `src/commands/channels/annotations/subscribe.ts` | Subscribe to annotation events command |
| `src/commands/channels/annotations/validation.ts` | Shared validation utility |
| `test/unit/commands/channels/annotations/publish.test.ts` | Publish unit tests |
| `test/unit/commands/channels/annotations/delete.test.ts` | Delete unit tests |
| `test/unit/commands/channels/annotations/get.test.ts` | Get unit tests |
| `test/unit/commands/channels/annotations/subscribe.test.ts` | Subscribe unit tests |
| `test/unit/commands/channels/annotations/validation.test.ts` | Validation unit tests |

### Modified Files

| File | Change |
|------|--------|
| `test/helpers/mock-ably-realtime.ts` | Add `MockAnnotations` interface and `annotations` property to mock channels |

---

## 14. Changelog of Improvements (vs. original plan)

This section documents all changes made to the original implementation plan based on thorough SDK source code review:

| # | Area | Change | Reason |
|---|------|--------|--------|
| 1 | **New command** | Added `ably channels annotations get` (Section 5.3) | Missing command for `channel.annotations.get(messageSerial, params)` |
| 2 | **Flag architecture** | Changed `...AblyBaseCommand.globalFlags` → `...productApiFlags` + `...clientIdFlag` | Per project conventions in [`src/flags.ts`](src/flags.ts) and [`.claude/CLAUDE.md`](.claude/CLAUDE.md) |
| 3 | **Output helpers** | Use `progress()`, `success()`, `listening()`, `resource()`, `formatTimestamp()` from [`src/utils/output.ts`](src/utils/output.ts) | Per project output conventions |
| 4 | **Subscribe cleanup** | Added `channel.annotations.unsubscribe()` on exit | Per [`annotations-improvments.txt`](annotations-improvments.txt) |
| 5 | **SDK event emission** | Documented that SDK emits on `annotation.type` not `annotation.action` | Source code review of [`realtimeannotations.ts:91`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:91) |
| 6 | **Key Types** | Added `encoding`, `extras` fields to `Annotation`; added `GetAnnotationsParams`, `PaginatedResult`, `ANNOTATION_PUBLISH` | Complete type documentation from [`ably.d.ts`](node_modules/ably/ably.d.ts) |
| 7 | **SDK API table** | Added `subscribe(type, listener)`, `unsubscribe(listener)`, `unsubscribe()` overloads | Complete API surface from type declarations |
| 8 | **REST delete** | Documented that `RestAnnotations.delete()` exists at runtime but not in `.d.ts` | Source code review of [`restannotations.ts:96`](node_modules/ably/src/common/lib/client/restannotations.ts:96) |
| 9 | **Transport choice** | Clarified: `get` uses REST client, `publish`/`delete` use Realtime, `subscribe` uses Realtime | `get` is REST under the hood; `publish`/`delete` consistent with other commands |
| 10 | **No encryption** | Added note that annotations are not encrypted | Source code review of [`annotation.ts:69`](node_modules/ably/src/common/lib/types/annotation.ts:69) |
| 11 | **Mock `_emit`** | Fixed to emit on `annotation.type` (not `annotation.action`) | Matches SDK behavior in `_processIncoming()` |
| 12 | **Mock `get` return** | Added `hasNext()` and `isLast()` to mock return value | Matches `PaginatedResult` interface |
| 13 | **Topic examples** | Added `get` subcommand to index topic examples | Complete subcommand listing |
| 14 | **Error handling** | Added try/catch with `jsonError()` pattern to all commands | Per project conventions |
| 15 | **SDK internals** | Added new "SDK Internal Details" subsection in Section 2 | Useful implementation reference from source code review |
