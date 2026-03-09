# Channels Annotations — Implementation Plan V2

## 1. Feature Overview

This document describes the implementation approach for adding **Message Annotations** support to the Ably CLI. Annotations allow clients to append metadata (reactions, tags, read receipts, etc.) to existing messages on a channel.

**Reference documentation:** [https://ably.com/docs/messages/annotations](https://ably.com/docs/messages/annotations)

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

> **Note on `delete`:** The TypeScript declaration file ([`ably.d.ts`](node_modules/ably/ably.d.ts)) only exposes `delete` on [`RealtimeAnnotations`](node_modules/ably/ably.d.ts:2201), not on [`RestAnnotations`](node_modules/ably/ably.d.ts:2834). However, the runtime source code in [`restannotations.ts`](node_modules/ably/src/common/lib/client/restannotations.ts:96) **does** implement `delete` by delegating to `publish` with `action = 'annotation.delete'`. For the CLI, we use the Realtime client for `publish` and `delete` (consistent with other channel commands), and the REST client for `get`.

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

### SDK Internal Details

- [`RestAnnotations.delete()`](node_modules/ably/src/common/lib/client/restannotations.ts:96) sets `action = 'annotation.delete'` then delegates to `publish()`
- [`RealtimeAnnotations.delete()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:51) same pattern
- [`RealtimeAnnotations.get()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:95) delegates to `RestAnnotations.prototype.get` (REST call under the hood)
- [`RealtimeAnnotations._processIncoming()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:89) emits on `annotation.type` (not `annotation.action`), so `subscribe(type, listener)` filters by annotation type string
- [`RealtimeAnnotations.subscribe()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:56) checks for `ANNOTATION_SUBSCRIBE` channel mode flag and throws `ErrorInfo(93001)` if not set
- Annotations are **not encrypted** — data needs to be parsed by the server for summarisation

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
├── presence.ts           # BaseTopicCommand — "ably channels presence"
├── occupancy.ts          # BaseTopicCommand — "ably channels occupancy"
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
src/commands/channels/annotations.ts          # BaseTopicCommand — "ably channels annotations"
src/commands/channels/annotations/
├── publish.ts            # "ably channels annotations publish"
├── delete.ts             # "ably channels annotations delete"
├── get.ts                # "ably channels annotations get"
└── subscribe.ts          # "ably channels annotations subscribe"

src/utils/annotations.ts  # Shared validation utility (NOT in commands dir)

test/unit/commands/channels/annotations/
├── publish.test.ts
├── delete.test.ts
├── get.test.ts
├── subscribe.test.ts

test/unit/utils/annotations.test.ts  # Validation unit tests
```

> **Note on topic command location:** The topic command file is [`src/commands/channels/annotations.ts`](src/commands/channels/annotations.ts) (not `index.ts` inside the directory), following the pattern of [`src/commands/channels/presence.ts`](src/commands/channels/presence.ts) and [`src/commands/channels/occupancy.ts`](src/commands/channels/occupancy.ts).

> **Note on validation utility location:** The validation utility goes in [`src/utils/annotations.ts`](src/utils/annotations.ts) per project conventions — utilities belong in `src/utils/`, not alongside commands. The old plan placed it in `src/commands/channels/annotations/validation.ts` which is incorrect.

### Base Class Inheritance

All annotation commands extend [`AblyBaseCommand`](src/base-command.ts:98) which provides:
- [`createAblyRealtimeClient(flags)`](src/base-command.ts) — creates authenticated Realtime client
- [`createAblyRestClient(flags)`](src/base-command.ts) — creates authenticated REST client
- [`setupConnectionStateLogging()`](src/base-command.ts:1297) — connection state event logging
- [`setupChannelStateLogging()`](src/base-command.ts:1362) — channel state event logging
- [`logCliEvent()`](src/base-command.ts) — structured event logging (verbose/JSON modes)
- [`formatJsonOutput()`](src/base-command.ts) — JSON output formatting
- [`shouldOutputJson()`](src/base-command.ts) — check for `--json` / `--pretty-json` flags
- [`handleCommandError()`](src/base-command.ts:1468) — centralized error handler for catch blocks
- [`waitAndTrackCleanup()`](src/base-command.ts:1490) — wait for interrupt/timeout with cleanup tracking
- [`jsonError()`](src/base-command.ts:1427) — emit structured JSON error
- [`parseJsonFlag()`](src/base-command.ts:1441) — parse JSON string flag with error handling

### Flag Architecture

Per the project's flag conventions in [`src/flags.ts`](src/flags.ts), commands must use composable flag sets:

- **`productApiFlags`** — core global flags + hidden product API flags (for all annotation commands)
- **`clientIdFlag`** — `--client-id` flag (for `publish`, `delete`, and `subscribe` since they create realtime connections)
- **`durationFlag`** — `--duration` / `-D` flag (for `subscribe` since it's a long-running command)

Output helpers from [`src/utils/output.ts`](src/utils/output.ts):
- [`progress(message)`](src/utils/output.ts:4) — progress indicator (appends `...` automatically)
- [`success(message)`](src/utils/output.ts:8) — green ✓ success message (must end with `.`)
- [`listening(description)`](src/utils/output.ts:12) — dim listening message with "Press Ctrl+C to exit."
- [`resource(name)`](src/utils/output.ts:16) — cyan resource name (never quoted)
- [`formatTimestamp(ts)`](src/utils/output.ts:20) — dim `[timestamp]` for event streams
- [`formatMessageTimestamp(ts)`](src/utils/output.ts:28) — converts Ably timestamp to ISO string
- [`limitWarning(count, limit, resourceName)`](src/utils/output.ts:54) — limit hint when results may be truncated

Error utility from [`src/utils/errors.ts`](src/utils/errors.ts):
- [`errorMessage(error)`](src/utils/errors.ts:4) — extract human-readable message from unknown error

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
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import { resource, success } from "../../../utils/output.js";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../utils/annotations.js";

export default class ChannelsAnnotationsPublish extends AblyBaseCommand {
  static override description = "Publish an annotation on a message";

  static override examples = [
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:distinct.v1 --name thumbsup",
    '$ ably channels annotations publish my-channel msg-serial-123 reactions:multiple.v1 --name thumbsup --count 3 --data \'{"emoji":"👍"}\'',
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:flag.v1 --json",
  ];

  static override args = {
    channel: Args.string({ description: "Channel name", required: true }),
    msgSerial: Args.string({
      description: "Message serial to annotate",
      required: true,
    }),
    annotationType: Args.string({
      description: "Annotation type (e.g., reactions:flag.v1)",
      required: true,
    }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({
      description:
        "Annotation name (required for distinct/unique/multiple types)",
    }),
    count: Flags.integer({
      description: "Count value (required for multiple type)",
    }),
    data: Flags.string({ description: "Optional data payload (JSON string)" }),
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
        this.error(errors.join("\n"));
      }

      // 2. Build OutboundAnnotation
      const annotation: Ably.OutboundAnnotation = {
        type: args.annotationType,
      };
      if (flags.name) annotation.name = flags.name;
      if (flags.count !== undefined) annotation.count = flags.count;
      if (flags.data) {
        const parsed = this.parseJsonFlag(flags.data, "--data", flags);
        if (!parsed) return;
        annotation.data = parsed;
      }

      // 3. Create Ably Realtime client and publish
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      const channel = client.channels.get(args.channel);
      await channel.annotations.publish(args.msgSerial, annotation);

      // 4. Output success
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              success: true,
              channel: args.channel,
              messageSerial: args.msgSerial,
              annotationType: args.annotationType,
              name: flags.name || null,
              count: flags.count ?? null,
            },
            flags,
          ),
        );
      } else {
        this.log(
          success(
            `Annotation published to channel ${resource(args.channel)}.`,
          ),
        );
      }
    } catch (error) {
      this.handleCommandError(error, flags, "annotations:publish", {
        channel: args.channel,
        messageSerial: args.msgSerial,
      });
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
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import { resource, success } from "../../../utils/output.js";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../utils/annotations.js";

export default class ChannelsAnnotationsDelete extends AblyBaseCommand {
  static override description = "Delete an annotation from a message";

  static override examples = [
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:distinct.v1 --name thumbsup",
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:flag.v1 --json",
  ];

  static override args = {
    channel: Args.string({ description: "Channel name", required: true }),
    msgSerial: Args.string({
      description: "Message serial of the annotated message",
      required: true,
    }),
    annotationType: Args.string({
      description: "Annotation type (e.g., reactions:flag.v1)",
      required: true,
    }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({
      description:
        "Annotation name (required for distinct/unique/multiple types)",
    }),
    data: Flags.string({ description: "Optional data payload (JSON string)" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsDelete);

    try {
      // 1. Validate (same as publish, but count not needed for delete)
      const summarization = extractSummarizationType(args.annotationType);
      const errors = validateAnnotationParams(summarization, {
        name: flags.name,
        isDelete: true,
      });
      if (errors.length > 0) {
        this.error(errors.join("\n"));
      }

      // 2. Build OutboundAnnotation
      const annotation: Ably.OutboundAnnotation = {
        type: args.annotationType,
      };
      if (flags.name) annotation.name = flags.name;
      if (flags.data) {
        const parsed = this.parseJsonFlag(flags.data, "--data", flags);
        if (!parsed) return;
        annotation.data = parsed;
      }

      // 3. Create client and delete
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      const channel = client.channels.get(args.channel);
      await channel.annotations.delete(args.msgSerial, annotation);

      // 4. Output success
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              success: true,
              channel: args.channel,
              messageSerial: args.msgSerial,
              annotationType: args.annotationType,
              name: flags.name || null,
            },
            flags,
          ),
        );
      } else {
        this.log(
          success(
            `Annotation deleted from channel ${resource(args.channel)}.`,
          ),
        );
      }
    } catch (error) {
      this.handleCommandError(error, flags, "annotations:delete", {
        channel: args.channel,
        messageSerial: args.msgSerial,
      });
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

**Implementation approach:**

This is a REST-style paginated query, similar to [`channels history`](src/commands/channels/history.ts). It uses a REST client since `annotations.get()` is a REST call under the hood.

```typescript
import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import {
  formatTimestamp,
  formatMessageTimestamp,
  limitWarning,
  resource,
} from "../../../utils/output.js";

export default class ChannelsAnnotationsGet extends AblyBaseCommand {
  static override description = "Get annotations for a message";

  static override examples = [
    "$ ably channels annotations get my-channel msg-serial-123",
    "$ ably channels annotations get my-channel msg-serial-123 --limit 50",
    "$ ably channels annotations get my-channel msg-serial-123 --json",
  ];

  static override args = {
    channel: Args.string({ description: "Channel name", required: true }),
    msgSerial: Args.string({
      description: "Message serial to get annotations for",
      required: true,
    }),
  };

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return (default: 100)",
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
        this.log(
          this.formatJsonOutput(
            annotations.map((annotation) => ({
              id: annotation.id,
              action: annotation.action,
              type: annotation.type,
              name: annotation.name || null,
              clientId: annotation.clientId || null,
              count: annotation.count ?? null,
              data: annotation.data ?? null,
              messageSerial: annotation.messageSerial,
              serial: annotation.serial,
              timestamp: annotation.timestamp,
            })),
            flags,
          ),
        );
      } else {
        if (annotations.length === 0) {
          this.log(
            `No annotations found for message ${resource(args.msgSerial)} on channel ${resource(args.channel)}.`,
          );
          return;
        }

        this.log(
          `Annotations for message ${resource(args.msgSerial)} on channel ${resource(args.channel)}:\n`,
        );

        for (const [index, annotation] of annotations.entries()) {
          const timestamp = formatMessageTimestamp(annotation.timestamp);
          const actionLabel =
            annotation.action === "annotation.create"
              ? chalk.green("CREATE")
              : chalk.red("DELETE");

          this.log(
            `${chalk.dim(`[${index + 1}]`)} ${formatTimestamp(timestamp)} ${actionLabel}`,
          );
          this.log(`${chalk.dim("Type:")} ${annotation.type}`);
          this.log(
            `${chalk.dim("Name:")} ${annotation.name || "(none)"}`,
          );
          if (annotation.clientId) {
            this.log(
              `${chalk.dim("Client ID:")} ${chalk.blue(annotation.clientId)}`,
            );
          }
          if (annotation.count !== undefined) {
            this.log(`${chalk.dim("Count:")} ${annotation.count}`);
          }
          if (annotation.data) {
            this.log(
              `${chalk.dim("Data:")} ${JSON.stringify(annotation.data)}`,
            );
          }
          this.log(""); // Blank line between annotations
        }

        const warning = limitWarning(
          annotations.length,
          flags.limit,
          "annotations",
        );
        if (warning) this.log(warning);
      }
    } catch (error) {
      this.handleCommandError(error, flags, "annotations:get", {
        channel: args.channel,
        messageSerial: args.msgSerial,
      });
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

This is a long-running command that listens for annotation events. It follows the same pattern as [`channels presence subscribe`](src/commands/channels/presence/subscribe.ts) and [`channels occupancy subscribe`](src/commands/channels/occupancy/subscribe.ts), using [`waitAndTrackCleanup()`](src/base-command.ts:1490) for the wait loop and [`handleCommandError()`](src/base-command.ts:1468) for error handling.

**Important SDK detail:** The SDK's [`_processIncoming()`](node_modules/ably/src/common/lib/client/realtimeannotations.ts:89) emits events keyed by `annotation.type` (not `annotation.action`). When calling `subscribe(listener)` without a type filter, the listener receives all annotation events regardless of type.

```typescript
import { Args } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatTimestamp,
  formatMessageTimestamp,
  listening,
  progress,
  resource,
  success,
} from "../../../utils/output.js";

export default class ChannelsAnnotationsSubscribe extends AblyBaseCommand {
  static override description = "Subscribe to annotation events on a channel";

  static override examples = [
    "$ ably channels annotations subscribe my-channel",
    "$ ably channels annotations subscribe my-channel --json",
    "$ ably channels annotations subscribe my-channel --duration 30",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably channels annotations subscribe my-channel',
  ];

  static override args = {
    channel: Args.string({ description: "Channel name", required: true }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private client: Ably.Realtime | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsSubscribe);

    try {
      // 1. Create Realtime client
      this.client = await this.createAblyRealtimeClient(flags);
      if (!this.client) return;

      const client = this.client;
      const channelName = args.channel;

      // 2. Get channel with ANNOTATION_SUBSCRIBE mode
      const channel = client.channels.get(channelName, {
        modes: ["ANNOTATION_SUBSCRIBE"],
      });

      // 3. Setup connection & channel state logging
      this.setupConnectionStateLogging(client, flags, {
        includeUserFriendlyMessages: true,
      });
      this.setupChannelStateLogging(channel, flags, {
        includeUserFriendlyMessages: true,
      });

      // 4. Subscribe to annotations
      this.logCliEvent(
        flags,
        "annotations",
        "subscribing",
        `Subscribing to annotation events on channel: ${channelName}`,
        { channel: channelName },
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          progress(
            `Subscribing to annotation events on channel: ${resource(channelName)}`,
          ),
        );
      }

      await channel.annotations.subscribe((annotation: Ably.Annotation) => {
        const timestamp = formatMessageTimestamp(annotation.timestamp);
        const event = {
          action: annotation.action,
          channel: channelName,
          clientId: annotation.clientId || null,
          count: annotation.count ?? null,
          data: annotation.data ?? null,
          messageSerial: annotation.messageSerial,
          name: annotation.name || null,
          serial: annotation.serial,
          timestamp,
          type: annotation.type,
        };

        this.logCliEvent(
          flags,
          "annotations",
          annotation.action,
          `Annotation event: ${annotation.action} by ${annotation.clientId || "unknown"}`,
          event,
        );

        if (this.shouldOutputJson(flags)) {
          this.log(this.formatJsonOutput(event, flags));
        } else {
          const actionLabel =
            annotation.action === "annotation.create"
              ? chalk.green("CREATE")
              : chalk.red("DELETE");
          this.log(
            `${formatTimestamp(timestamp)} ${actionLabel} | ${chalk.dim("Type:")} ${annotation.type} | ${chalk.dim("Name:")} ${annotation.name || "(none)"} | ${chalk.dim("Client:")} ${annotation.clientId ? chalk.blue(annotation.clientId) : "(none)"}`,
          );
          if (annotation.data) {
            this.log(
              `  ${chalk.dim("Data:")} ${JSON.stringify(annotation.data)}`,
            );
          }
          this.log(""); // Empty line for readability
        }
      });

      // 5. Show success message
      if (!this.shouldOutputJson(flags)) {
        this.log(
          success(
            `Subscribed to annotations on channel: ${resource(channelName)}.`,
          ),
        );
        this.log(listening("Listening for annotation events."));
      }

      this.logCliEvent(
        flags,
        "annotations",
        "listening",
        "Listening for annotation events. Press Ctrl+C to exit.",
      );

      // 6. Wait until interrupted or timeout, then cleanup
      await this.waitAndTrackCleanup(flags, "annotations", flags.duration);
    } catch (error) {
      this.handleCommandError(error, flags, "annotations:subscribe", {
        channel: args.channel,
      });
    }
  }
}
```

### 5.5 `ably channels annotations` (Topic Command)

**File:** [`src/commands/channels/annotations.ts`](src/commands/channels/annotations.ts)

This is the topic command that lists available annotation subcommands when run without arguments. It follows the exact pattern of [`src/commands/channels/presence.ts`](src/commands/channels/presence.ts).

```typescript
import { BaseTopicCommand } from "../../base-topic-command.js";

export default class ChannelsAnnotations extends BaseTopicCommand {
  protected topicName = "channels:annotations";
  protected commandGroup = "channel annotations";

  static override description = "Manage annotations on Ably channel messages";

  static override examples = [
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations get my-channel msg-serial-123",
    "$ ably channels annotations subscribe my-channel",
  ];
}
```

---

## 6. Shared Validation Utility

**File:** [`src/utils/annotations.ts`](src/utils/annotations.ts)

This utility is placed in `src/utils/` (not alongside commands) per project conventions.

```typescript
/**
 * Extract the summarization method from an annotation type string.
 * Format: "namespace:summarization.version" → returns "summarization"
 */
export function extractSummarizationType(annotationType: string): string {
  const colonIndex = annotationType.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(
      'Invalid annotation type format. Expected "namespace:summarization.version" (e.g., "reactions:flag.v1")',
    );
  }
  const summarizationPart = annotationType.slice(colonIndex + 1);
  const dotIndex = summarizationPart.indexOf(".");
  if (dotIndex === -1) {
    throw new Error(
      'Invalid annotation type format. Expected "namespace:summarization.version" (e.g., "reactions:flag.v1")',
    );
  }
  return summarizationPart.slice(0, dotIndex);
}

/** Summarization types that require a `name` parameter */
const NAME_REQUIRED_TYPES = ["distinct", "unique", "multiple"];

/** Summarization types that require a `count` parameter */
const COUNT_REQUIRED_TYPES = ["multiple"];

/**
 * Validate that the required parameters are present for the given summarization type.
 */
export function validateAnnotationParams(
  summarization: string,
  options: { name?: string; count?: number; isDelete?: boolean },
): string[] {
  const errors: string[] = [];

  if (NAME_REQUIRED_TYPES.includes(summarization) && !options.name) {
    errors.push(
      `--name is required for "${summarization}" annotation types`,
    );
  }

  // count is only required for publish, not delete
  if (
    !options.isDelete &&
    COUNT_REQUIRED_TYPES.includes(summarization) &&
    options.count === undefined
  ) {
    errors.push(
      `--count is required for "${summarization}" annotation types`,
    );
  }

  return errors;
}
```

---

## 7. Mock Updates for Testing

### 7.1 Changes to [`test/helpers/mock-ably-realtime.ts`](test/helpers/mock-ably-realtime.ts)

The existing [`MockRealtimeChannel`](test/helpers/mock-ably-realtime.ts:33) interface needs to be extended to include an `annotations` property:

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
      } else if (typeof typeOrCallback === "function") {
        emitter.off(null, typeOrCallback);
      } else if (callback) {
        emitter.off(typeOrCallback, callback);
      }
    }),
    get: vi.fn().mockResolvedValue({
      items: [],
      hasNext: () => false,
      isLast: () => true,
    }),
    _emitter: emitter,
    // Note: SDK emits on annotation.type, not annotation.action
    _emit: (annotation) => {
      emitter.emit(annotation.type || "", annotation);
    },
  };

  return annotations;
}
```

Then add `annotations: createMockAnnotations()` to the [`createMockChannel()`](test/helpers/mock-ably-realtime.ts:177) function.

### 7.2 Changes to [`test/helpers/mock-ably-rest.ts`](test/helpers/mock-ably-rest.ts)

The `get` command uses a REST client, so [`MockRestChannel`](test/helpers/mock-ably-rest.ts:26) also needs an `annotations` property:

```typescript
// Add new interface
export interface MockRestAnnotations {
  publish: Mock;
  get: Mock;
}

// Update MockRestChannel to include annotations
export interface MockRestChannel {
  // ... existing fields ...
  annotations: MockRestAnnotations;
}
```

Add a `createMockRestAnnotations()` factory function:

```typescript
function createMockRestAnnotations(): MockRestAnnotations {
  return {
    publish: vi.fn().mockImplementation(async () => {}),
    get: vi.fn().mockResolvedValue({
      items: [],
      hasNext: () => false,
      isLast: () => true,
    }),
  };
}
```

Then add `annotations: createMockRestAnnotations()` to the [`createMockRestChannel()`](test/helpers/mock-ably-rest.ts:116) function.

---

## 8. Test Plan

### Unit Tests

Each command gets a dedicated test file following the pattern in [`test/unit/commands/channels/publish.test.ts`](test/unit/commands/channels/publish.test.ts). Tests use `runCommand` from `@oclif/test` and the centralized mock helpers.

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
| API error handling | Verify error propagation via `handleCommandError` |
| With `--data` flag | Verify data payload is included |
| Invalid `--data` JSON | Verify `parseJsonFlag` error handling |

#### [`test/unit/commands/channels/annotations/delete.test.ts`](test/unit/commands/channels/annotations/delete.test.ts)

| Test Case | Description |
|-----------|-------------|
| Delete with `flag.v1` type | Verify delete with only `type` arg succeeds |
| Delete with `distinct.v1` + `--name` | Verify delete with `name` flag succeeds |
| Missing `--name` for `unique.v1` | Verify validation error |
| JSON output mode | Verify structured JSON output |
| API error handling | Verify error propagation via `handleCommandError` |

#### [`test/unit/commands/channels/annotations/get.test.ts`](test/unit/commands/channels/annotations/get.test.ts)

| Test Case | Description |
|-----------|-------------|
| Get annotations with default limit | Verify `channel.annotations.get()` is called with `{ limit: 100 }` |
| Get annotations with custom `--limit` | Verify limit param is passed correctly |
| Empty result set | Verify "No annotations found" message |
| Multiple annotations returned | Verify all annotations are displayed |
| JSON output mode | Verify structured JSON output with all annotation fields |
| API error handling | Verify error propagation via `handleCommandError` |
| Limit warning message | Verify `limitWarning()` shown when result count equals limit |

#### [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts)

| Test Case | Description |
|-----------|-------------|
| Subscribe to channel | Verify `channel.annotations.subscribe()` is called |
| Receive `annotation.create` event | Verify create event is displayed |
| Receive `annotation.delete` event | Verify delete event is displayed |
| JSON output mode | Verify structured JSON output for events |
| Channel with `ANNOTATION_SUBSCRIBE` mode | Verify channel mode is set correctly |
| Duration flag | Verify auto-exit after timeout |

#### [`test/unit/utils/annotations.test.ts`](test/unit/utils/annotations.test.ts)

| Test Case | Description |
|-----------|-------------|
| Parse valid annotation types | Various valid formats |
| Reject invalid formats | Missing colon, missing dot, etc. |
| Validate `total.v1` params | No extra params needed |
| Validate `flag.v1` params | No extra params needed |
| Validate `distinct.v1` params | Name required |
| Validate `unique.v1` params | Name required |
| Validate `multiple.v1` params | Name + count required |
| Validate `multiple.v1` delete | Name required, count not required |
| Unknown summarization type | Should pass (forward compatibility) |

---

## 9. Integration Steps

### Step-by-step implementation order:

1. **Create shared validation utility**
   - [`src/utils/annotations.ts`](src/utils/annotations.ts)
   - [`test/unit/utils/annotations.test.ts`](test/unit/utils/annotations.test.ts)

2. **Update mock helpers**
   - Add `MockAnnotations` to [`test/helpers/mock-ably-realtime.ts`](test/helpers/mock-ably-realtime.ts)
   - Add `MockRestAnnotations` to [`test/helpers/mock-ably-rest.ts`](test/helpers/mock-ably-rest.ts)

3. **Create topic command**
   - [`src/commands/channels/annotations.ts`](src/commands/channels/annotations.ts)

4. **Create `publish` command + tests**
   - [`src/commands/channels/annotations/publish.ts`](src/commands/channels/annotations/publish.ts)
   - [`test/unit/commands/channels/annotations/publish.test.ts`](test/unit/commands/channels/annotations/publish.test.ts)

5. **Create `delete` command + tests**
   - [`src/commands/channels/annotations/delete.ts`](src/commands/channels/annotations/delete.ts)
   - [`test/unit/commands/channels/annotations/delete.test.ts`](test/unit/commands/channels/annotations/delete.test.ts)

6. **Create `get` command + tests**
   - [`src/commands/channels/annotations/get.ts`](src/commands/channels/annotations/get.ts)
   - [`test/unit/commands/channels/annotations/get.test.ts`](test/unit/commands/channels/annotations/get.test.ts)

7. **Create `subscribe` command + tests**
   - [`src/commands/channels/annotations/subscribe.ts`](src/commands/channels/annotations/subscribe.ts)
   - [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts)

8. **Run mandatory workflow**
   ```bash
   pnpm prepare        # Build + update manifest/README
   pnpm exec eslint .  # Lint (must be 0 errors)
   pnpm test:unit      # Run unit tests
   ```

9. **Update documentation**
   - Update [`docs/Project-Structure.md`](docs/Project-Structure.md) with new files

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

[1] [2026-03-05T09:00:00.000Z] CREATE
Type: reactions:flag.v1
Name: (none)
Client ID: user-123

[2] [2026-03-05T09:00:01.000Z] CREATE
Type: reactions:distinct.v1
Name: thumbsup
Client ID: user-456
Data: {"emoji":"👍"}
```

### Get — JSON (`--json`)

```json
[
  {
    "id": "ann-001",
    "action": "annotation.create",
    "type": "reactions:flag.v1",
    "name": null,
    "clientId": "user-123",
    "count": null,
    "data": null,
    "messageSerial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800000-0",
    "serial": "01ARZ3NDEKTSV4RRFFQ69G5FAV@1614556800001-0",
    "timestamp": 1741165200000
  }
]
```

### Subscribe — Human-readable

```
Subscribing to annotation events on channel: my-channel...
✓ Subscribed to annotations on channel: my-channel.
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

---

## 11. Edge Cases & Considerations

1. **Forward compatibility**: Unknown summarization types should be allowed (no validation error) since new types may be added server-side.

2. **Client ID requirement**: `flag.v1`, `distinct.v1`, and `unique.v1` require identified clients. The CLI auto-generates a `clientId` unless `--client-id none` is specified.

3. **Channel mode for subscribe**: The subscribe command must request `ANNOTATION_SUBSCRIBE` mode via `ChannelOptions.modes`. The SDK will throw `ErrorInfo(93001)` if you try to subscribe without this mode.

4. **Data payload parsing**: The `--data` flag accepts a JSON string. Use [`parseJsonFlag()`](src/base-command.ts:1441) for consistent error handling (not inline try/catch).

5. **REST vs Realtime transport**:
   - `publish` and `delete` → use **Realtime** client (consistent with other channel commands)
   - `get` → use **REST** client (it's a REST call, similar to `channels history`)
   - `subscribe` → use **Realtime** client (requires persistent connection)

6. **Annotations are not encrypted**: The SDK does not encrypt annotation data. No `--cipher-key` flag is needed.

7. **Subscribe event emission**: The SDK emits annotation events keyed by `annotation.type` (not `annotation.action`). `subscribe(type, listener)` filters by annotation type string, while `subscribe(listener)` receives all.

8. **Web CLI mode**: Annotations commands should work in web CLI mode since they are data-plane operations, similar to existing channel commands.

9. **JSON timestamp format**: In JSON output, the `get` command outputs raw millisecond timestamps (consistent with `channels history`). The `subscribe` command outputs ISO string timestamps (consistent with `channels presence subscribe`).

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
| [`src/commands/channels/annotations.ts`](src/commands/channels/annotations.ts) | Topic command (lists subcommands) |
| [`src/commands/channels/annotations/publish.ts`](src/commands/channels/annotations/publish.ts) | Publish annotation command |
| [`src/commands/channels/annotations/delete.ts`](src/commands/channels/annotations/delete.ts) | Delete annotation command |
| [`src/commands/channels/annotations/get.ts`](src/commands/channels/annotations/get.ts) | Get annotations for a message (paginated) |
| [`src/commands/channels/annotations/subscribe.ts`](src/commands/channels/annotations/subscribe.ts) | Subscribe to annotation events command |
| [`src/utils/annotations.ts`](src/utils/annotations.ts) | Shared validation utility |
| [`test/unit/commands/channels/annotations/publish.test.ts`](test/unit/commands/channels/annotations/publish.test.ts) | Publish unit tests |
| [`test/unit/commands/channels/annotations/delete.test.ts`](test/unit/commands/channels/annotations/delete.test.ts) | Delete unit tests |
| [`test/unit/commands/channels/annotations/get.test.ts`](test/unit/commands/channels/annotations/get.test.ts) | Get unit tests |
| [`test/unit/commands/channels/annotations/subscribe.test.ts`](test/unit/commands/channels/annotations/subscribe.test.ts) | Subscribe unit tests |
| [`test/unit/utils/annotations.test.ts`](test/unit/utils/annotations.test.ts) | Validation unit tests |

### Modified Files

| File | Change |
|------|--------|
| [`test/helpers/mock-ably-realtime.ts`](test/helpers/mock-ably-realtime.ts) | Add `MockAnnotations` interface and `annotations` property to mock channels |
| [`test/helpers/mock-ably-rest.ts`](test/helpers/mock-ably-rest.ts) | Add `MockRestAnnotations` interface and `annotations` property to mock REST channels |
| [`docs/Project-Structure.md`](docs/Project-Structure.md) | Document new annotation files |

---

## 14. Changes from V1 Plan

This section documents all changes made from the original [`ANNOTATIONS_IMPL.md`](ANNOTATIONS_IMPL.md) based on thorough codebase review:

| # | Area | V1 (Old) | V2 (New) | Reason |
|---|------|----------|----------|--------|
| 1 | **Error handling** | Manual try/catch with inline `error instanceof Error ? error.message : String(error)` | Use [`handleCommandError()`](src/base-command.ts:1468) in catch blocks | Centralized error handler added to base command since V1 was written |
| 2 | **JSON data parsing** | Inline `try { JSON.parse(flags.data) } catch { this.error(...) }` | Use [`parseJsonFlag()`](src/base-command.ts:1441) | Base command now provides this utility |
| 3 | **Subscribe wait loop** | Raw `waitUntilInterruptedOrTimeout()` + manual `channel.annotations.unsubscribe()` + manual `logCliEvent` | Use [`waitAndTrackCleanup()`](src/base-command.ts:1490) | Centralized wait+cleanup pattern added to base command |
| 4 | **Duration flag** | Inline `Flags.integer({ description: '...', char: 'D' })` | Use composable [`durationFlag`](src/flags.ts:104) from `src/flags.ts` | Composable flag sets are the standard pattern |
| 5 | **Validation utility location** | `src/commands/channels/annotations/validation.ts` | [`src/utils/annotations.ts`](src/utils/annotations.ts) | Utilities belong in `src/utils/`, not alongside commands |
| 6 | **Topic command location** | `src/commands/channels/annotations/index.ts` | [`src/commands/channels/annotations.ts`](src/commands/channels/annotations.ts) | Follows pattern of [`presence.ts`](src/commands/channels/presence.ts) and [`occupancy.ts`](src/commands/channels/occupancy.ts) |
| 7 | **REST mock updates** | Not mentioned | Add `MockRestAnnotations` to [`mock-ably-rest.ts`](test/helpers/mock-ably-rest.ts) | `get` command uses REST client, needs REST mock |
| 8 | **Limit warning** | Manual `if (annotations.length === flags.limit)` with inline chalk | Use [`limitWarning()`](src/utils/output.ts:54) from output utils | Utility added since V1 was written |
| 9 | **Timestamp formatting** | Inline `new Date(annotation.timestamp).toISOString()` | Use [`formatMessageTimestamp()`](src/utils/output.ts:28) from output utils | Utility added since V1 was written |
| 10 | **Get output format** | Single-line per annotation with `\|` separators | Multi-line per annotation (field per line) | Consistent with `channels history` output pattern using `chalk.dim("Label:")` |
| 11 | **JSON timestamp in get** | ISO string conversion | Raw millisecond timestamps | Consistent with `channels history` JSON output (raw ms, not ISO) |
| 12 | **Test file location** | `test/unit/commands/channels/annotations/validation.test.ts` | [`test/unit/utils/annotations.test.ts`](test/unit/utils/annotations.test.ts) | Matches utility file location |
| 13 | **Subscribe cleanup** | Manual `channel.annotations.unsubscribe()` after `waitUntilInterruptedOrTimeout` | Handled by `waitAndTrackCleanup()` + base command's `finally()` | Base command handles client cleanup automatically |
| 14 | **`logCliEvent` component naming** | Used `'annotations:subscribe'` for all logging | Uses `'annotations'` for `logCliEvent` (consistent with `'presence'`, `'occupancy'`), but explicit `'annotations:publish'`/`'annotations:delete'`/`'annotations:get'`/`'annotations:subscribe'` for `handleCommandError` | `logCliEvent` follows existing patterns; `handleCommandError` uses explicit names for better error traceability |
| 15 | **Private client field** | Not stored | `private client: Ably.Realtime \| null = null` in subscribe | Follows pattern of [`channels subscribe`](src/commands/channels/subscribe.ts:78) and [`presence subscribe`](src/commands/channels/presence/subscribe.ts:41) |
| 16 | **`errorMessage()` utility** | Not used | Available via [`src/utils/errors.ts`](src/utils/errors.ts) | Utility exists but `handleCommandError` handles this internally |
