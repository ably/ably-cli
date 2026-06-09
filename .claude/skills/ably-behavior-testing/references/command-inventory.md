# Command Inventory

Complete list of commands to test, organized by API type. Update this when commands are added or removed.

**Important**: Each command lists its **data prerequisites** — what must run before it to produce non-empty, meaningful output. A command tested without its prerequisites may return empty results, which is a **test failure** (see "Non-Empty Output Requirement" in SKILL.md).

---

## Product API Commands (Ably SDK)

These commands use the Ably SDK (REST or Realtime) and authenticate via API key.

### Channels (`ably channels`)

#### Top-Level Commands
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `channels publish <channel> <message>` | Publish (one-shot) | None — produces data |
| `channels subscribe <channel...>` | Subscribe (long-running) | Publish messages to same channel while subscriber is running |
| `channels history <channel>` | History (paginated) | Publish messages to the channel first |
| `channels list` | List (paginated) | Attach to or publish on at least one channel first |
| `channels inspect <channel>` | Get (one-shot) | None — opens dashboard |
| `channels batch-publish` | Publish (batch) | None — produces data |
| `channels append <channel> <serial> <message>` | REST mutation | Publish a message first to get a serial |
| `channels update <channel> <serial> <message>` | REST mutation | Publish a message first to get a serial |
| `channels delete <channel> <serial>` | REST mutation | Publish a message first to get a serial |

#### Presence Subcommands (`ably channels presence`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `channels presence enter <channel>` | Enter/Hold (long-running) | None — produces its own data |
| `channels presence get <channel>` | Get (one-shot) | Enter presence on the channel first (run `presence enter` in background) |
| `channels presence subscribe <channel>` | Subscribe (long-running) | Enter/leave presence on the channel while subscriber is running |

#### Occupancy Subcommands (`ably channels occupancy`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `channels occupancy get <channel>` | Get (one-shot) | Subscribe or enter presence on the channel first to generate occupancy |
| `channels occupancy subscribe <channel>` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Events from occupancy changes. **Verify successful subscription only.** Non-empty output is a bonus if concurrent subscribe/enter activity occurs. |

#### Annotations Subcommands (`ably channels annotations`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `channels annotations publish <channel> <serial> <type>` | Publish | Publish a message first to get a serial |
| `channels annotations subscribe <channel>` | Subscribe (long-running) | Publish annotations on the channel while subscriber is running |
| `channels annotations get <channel> <serial>` | Get (one-shot) | Publish annotations on the message first |
| `channels annotations delete <channel> <serial> <type>` | REST mutation | Publish an annotation first to have something to delete |

---

### Rooms (`ably rooms`)

#### Top-Level Commands
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms list` | List (paginated) | Send a message or enter presence in at least one room first |

#### Messages Subcommands (`ably rooms messages`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms messages send <room> <message>` | Send (one-shot) | None — produces data |
| `rooms messages subscribe <room...>` | Subscribe (long-running) | Send messages to the room while subscriber is running |
| `rooms messages history <room>` | History (paginated) | Send messages to the room first |
| `rooms messages update <room> <serial> <text>` | REST mutation | Send a message first to get a serial |
| `rooms messages delete <room> <serial>` | REST mutation | Send a message first to get a serial |

#### Message Reactions Subcommands (`ably rooms messages reactions`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms messages reactions send <room> <messageserial> <reaction>` | Send | Send a message first to get a messageserial |
| `rooms messages reactions remove <room> <messageserial> <reaction>` | REST mutation | Send a reaction first to have something to remove |
| `rooms messages reactions subscribe <room>` | Subscribe (long-running) | Send message reactions while subscriber is running |

#### Presence Subcommands (`ably rooms presence`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms presence enter <room>` | Enter/Hold (long-running) | None — produces its own data |
| `rooms presence get <room>` | Get (one-shot) | Enter presence in the room first (run `presence enter` in background) |
| `rooms presence subscribe <room>` | Subscribe (long-running) | Enter/leave presence in the room while subscriber is running |

#### Occupancy Subcommands (`ably rooms occupancy`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms occupancy get <room>` | Get (one-shot) | Subscribe or enter presence in the room first to generate occupancy |
| `rooms occupancy subscribe <room>` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Events from occupancy changes. **Verify successful subscription only.** Non-empty output is a bonus if concurrent activity occurs. |

#### Reactions Subcommands (`ably rooms reactions`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms reactions send <room> <emoji>` | Send | None — produces data |
| `rooms reactions subscribe <room>` | Subscribe (long-running) | Send room-level reactions while subscriber is running |

#### Typing Subcommands (`ably rooms typing`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `rooms typing keystroke <room>` | Send | None — produces data |
| `rooms typing subscribe <room>` | Subscribe (long-running) | Send typing keystrokes while subscriber is running |

---

### Spaces (`ably spaces`)

#### Top-Level Commands
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `spaces create <space>` | Create (one-shot) | None — produces data |
| `spaces get <space>` | Get (one-shot) | Create the space or enter members first |
| `spaces list` | List (paginated) | Enter at least one space first |
| `spaces subscribe <space>` | Subscribe (long-running) | Enter/leave members, set locations, etc. while subscriber is running |

#### Members Subcommands (`ably spaces members`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `spaces members enter <space>` | Enter/Hold (long-running) | None — produces its own data |
| `spaces members get <space>` | Get (one-shot) | Enter the space first (run `members enter` in background) |
| `spaces members subscribe <space>` | Subscribe (long-running) | Enter/leave the space while subscriber is running |

#### Locations Subcommands (`ably spaces locations`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `spaces locations set <space>` | Set/Hold (long-running) | None — produces its own data |
| `spaces locations get <space>` | Get (one-shot) | Set a location in the space first (run `locations set` in background) |
| `spaces locations subscribe <space>` | Subscribe (long-running) | Set/update locations while subscriber is running |

#### Locks Subcommands (`ably spaces locks`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `spaces locks acquire <space> <lock>` | Acquire/Hold (long-running) | None — produces its own data |
| `spaces locks get <space>` | Get (one-shot) | Acquire a lock first (run `locks acquire` in background) |
| `spaces locks subscribe <space>` | Subscribe (long-running) | Acquire/release locks while subscriber is running |

#### Cursors Subcommands (`ably spaces cursors`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `spaces cursors set <space>` | Set/Hold (long-running) | None — produces its own data |
| `spaces cursors get <space>` | Get (one-shot) | Set a cursor in the space first (run `cursors set` in background) |
| `spaces cursors subscribe <space>` | Subscribe (long-running) | Set/update cursors while subscriber is running |

#### Occupancy Subcommands (`ably spaces occupancy`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `spaces occupancy get <space>` | Get (one-shot) | Enter the space or subscribe first to generate occupancy |
| `spaces occupancy subscribe <space>` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Events from occupancy changes. **Verify successful subscription only.** Non-empty output is a bonus if concurrent activity occurs. |

---

### Logs (`ably logs`)

#### Top-Level Commands
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `logs subscribe` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Events are system-generated app logs. **Verify successful subscription only** (listening message, clean exit). Non-empty output is a bonus if concurrent activity generates logs. |
| `logs history` | History (paginated) | Generate some activity first (publish messages, connect clients) |

#### Channel Lifecycle (`ably logs channel-lifecycle`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `logs channel-lifecycle subscribe` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Events from channel attach/detach on meta channel. **Verify successful subscription only.** Non-empty output is a bonus if concurrent channel activity occurs. |

#### Connection Lifecycle (`ably logs connection-lifecycle`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `logs connection-lifecycle subscribe` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Events from client connect/disconnect on meta channel. **Verify successful subscription only.** Non-empty output is a bonus if concurrent connection activity occurs. |
| `logs connection-lifecycle history` | History (paginated) | Generate connection activity first |

#### Push Logs (`ably logs push`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `logs push subscribe` | Subscribe (long-running) ⚡ **Observe-only** | No direct publish. Requires push notification infrastructure. **Verify successful subscription only.** Non-empty output unlikely without push setup. |
| `logs push history` | History (paginated) | Send push notifications first |

---

### Connections (`ably connections`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `connections test` | One-shot | None — produces its own data |

---

### Bench (`ably bench`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `bench publisher <channel>` | Long-running | None — produces its own data |
| `bench subscriber <channel>` | Long-running | Run publisher on same channel while subscriber is running |

---

## Control API Commands (HTTP)

These commands use the Ably Control API via HTTP and authenticate via access token.

### Accounts (`ably accounts`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `accounts login` | Auth flow | None — interactive |
| `accounts logout` | Auth flow | Must be logged in |
| `accounts current` | Get (one-shot) | Must be logged in |
| `accounts list` | List | Must have configured accounts |
| `accounts switch` | Config | Must have multiple accounts |

### Apps (`ably apps`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `apps create` | Create | None — produces data |
| `apps current` | Get (one-shot) | Must have a selected app |
| `apps list` | List | Must have apps in account |
| `apps update` | Update | Must have an app to update |
| `apps delete` | Delete (destructive) | Must have an app to delete |
| `apps switch` | Config | Must have multiple apps |

#### Rules (`ably apps rules`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `apps rules create` | Create | None — produces data |
| `apps rules list` | List | Create a rule first |
| `apps rules update` | Update | Create a rule first |
| `apps rules delete` | Delete (destructive) | Create a rule first |

### Auth (`ably auth`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `auth issue-ably-token` | Create | None — produces data |
| `auth issue-jwt-token` | Create | None — produces data |
| `auth revoke-token` | Delete | Issue a token first |

#### Keys (`ably auth keys`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `auth keys create` | Create | None — produces data |
| `auth keys current` | Get (one-shot) | Must have a selected key |
| `auth keys get <key-id>` | Get (one-shot) | Must have a key |
| `auth keys list` | List | Must have keys (app always has at least one) |
| `auth keys revoke <key-id>` | Delete (destructive) | Create a key first (don't revoke default) |
| `auth keys switch` | Config | Must have multiple keys |
| `auth keys update <key-id>` | Update | Must have a key |

### Queues (`ably queues`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `queues create` | Create | None — produces data |
| `queues list` | List | Create a queue first |
| `queues delete` | Delete (destructive) | Create a queue first |

### Integrations (`ably integrations`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `integrations create` | Create | None — produces data |
| `integrations get <id>` | Get (one-shot) | Create an integration first |
| `integrations list` | List | Create an integration first |
| `integrations update <id>` | Update | Create an integration first |
| `integrations delete <id>` | Delete (destructive) | Create an integration first |

### Push (`ably push`) — ⚠️ RESTRICTED

> **Never run push commands unless the user explicitly requests it.** Push requires APNs/FCM configuration. Skipped when "test all" is selected. If requested, verify config first via `push config show`. See SKILL.md "Push Command Group — Restricted" for the full protocol.

| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `push publish` | Publish | Requires a registered device or channel subscription |
| `push batch-publish` | Publish (batch) | Requires registered devices or channel subscriptions |

#### Push Channels (`ably push channels`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `push channels list` | List | Save a push channel subscription first |
| `push channels list-channels` | List | Save a push channel subscription first |
| `push channels save` | Create/Update | None — produces data |
| `push channels remove` | Delete | Save a subscription first |
| `push channels remove-where` | Delete (bulk) | Save subscriptions first |

#### Push Devices (`ably push devices`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `push devices get <id>` | Get (one-shot) | Save a device first |
| `push devices list` | List | Save a device first |
| `push devices save` | Create/Update | None — produces data |
| `push devices remove` | Delete | Save a device first |
| `push devices remove-where` | Delete (bulk) | Save devices first |

#### Push Config (`ably push config`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `push config show` | Get (one-shot) | None — shows config (may be empty if not configured) |
| `push config set-apns` | Update | Requires APNs certificate file |
| `push config set-fcm` | Update | Requires FCM service account file |
| `push config clear-apns` | Delete | Set APNs config first |
| `push config clear-fcm` | Delete | Set FCM config first |

### Stats (`ably stats`)
| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `stats app` | Get (one-shot) | Generate some app activity first (publish, subscribe) |
| `stats account` | Get (one-shot) | Generate some account activity first |

---

## Local / Utility Commands

These commands don't call external APIs or have mixed behavior.

| Command | Type | Prerequisites for Non-Empty Output |
|---------|------|------------------------------------|
| `login` | Auth flow | None — alias for `accounts login` |
| `version` | Local | None — always produces output |
| `status` | Local | None — always produces output |
| `config path` | Local | None — always produces output |
| `config show` | Local | None — always produces output |
| `autocomplete [SHELL]` | Local | None — generates shell completion scripts (oclif built-in) |
| `support ask` | External | None — interactive |
| `support contact` | External | None — opens browser |
| `interactive` | Interactive | None — launches interactive mode |
| `help` | Local | None — always produces output |
| `test wait` | Test utility | None — internal test command |

---

## Testing Priority Order

The phases below are ordered so that each phase builds on data produced by earlier phases. Within each phase, commands that **produce** data come before commands that **consume** it.

### Phase 1: Core Workflows (publish → subscribe → history)
1. `channels publish` → `channels subscribe` (verify messages received) → `channels history` (verify messages in history)
2. `rooms messages send` → `rooms messages subscribe` (verify messages received) → `rooms messages history` (verify messages in history)

### Phase 2: Message Mutations (require serial from Phase 1)
3. `channels append` / `channels update` / `channels delete` (use serial from publish)
4. `rooms messages update` / `rooms messages delete` (use serial from send)

### Phase 3: Annotations (require serial from Phase 1)
5. `channels annotations publish` → `channels annotations subscribe` (verify annotations received) → `channels annotations get` (verify annotations returned) → `channels annotations delete`

### Phase 4: Presence (enter → get → subscribe)
6. `channels presence enter` → `channels presence get` (verify member present) → `channels presence subscribe` (enter/leave while subscribed)
7. `rooms presence enter` → `rooms presence get` (verify member present) → `rooms presence subscribe` (enter/leave while subscribed)

### Phase 5: Spaces (enter/set/acquire → get → subscribe)
8. `spaces members enter` → `spaces members get` (verify member present) → `spaces members subscribe` (enter/leave while subscribed)
9. `spaces locations set` → `spaces locations get` (verify location returned) → `spaces locations subscribe` (set/update while subscribed)
10. `spaces locks acquire` → `spaces locks get` (verify lock returned) → `spaces locks subscribe` (acquire/release while subscribed)
11. `spaces cursors set` → `spaces cursors get` (verify cursor returned) → `spaces cursors subscribe` (set/update while subscribed)

### Phase 6: Lists and Occupancy (require activity from earlier phases)
12. `channels list` (channels should exist from Phase 1)
13. `rooms list` (rooms should exist from Phase 1)
14. `spaces list` + `spaces get` + `spaces create` (spaces should exist from Phase 5)
15. `channels occupancy get` + `channels occupancy subscribe`
16. `rooms occupancy get` + `rooms occupancy subscribe`
17. `spaces occupancy get` + `spaces occupancy subscribe`
18. `spaces subscribe` (enter/leave/set while subscribed)

### Phase 7: Rooms Extras (reactions + typing)
19. `rooms reactions send` → `rooms reactions subscribe` (verify reactions received)
20. `rooms messages reactions send` → `rooms messages reactions subscribe` (verify reactions received) → `rooms messages reactions remove`
21. `rooms typing keystroke` → `rooms typing subscribe` (verify typing events received)

### Phase 8: Logs (require activity from earlier phases)
22. `logs subscribe` + `logs history` (generate activity while subscribed)
23. `logs channel-lifecycle subscribe` (attach/detach channels while subscribed)
24. `logs connection-lifecycle subscribe` + `logs connection-lifecycle history`
25. `logs push subscribe` + `logs push history`

### Phase 9: Control API (CRUD — create → list → get → update → delete)
26. `apps create` → `apps list` → `apps update` → `apps delete`
27. `apps rules create` → `apps rules list` → `apps rules update` → `apps rules delete`
28. `auth keys create` → `auth keys list` → `auth keys get` → `auth keys update` → `auth keys revoke`
29. `auth issue-ably-token` + `auth issue-jwt-token` + `auth revoke-token`
30. `queues create` → `queues list` → `queues delete`
31. `integrations create` → `integrations list` → `integrations get` → `integrations update` → `integrations delete`

### Phase 10: Stats, Connections and Utilities
32. `stats app` + `stats account`
33. `connections test`
34. `bench publisher` + `bench subscriber`
35. `version` + `status` + `config show` + `config path`
