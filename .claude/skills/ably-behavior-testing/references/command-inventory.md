# Command Inventory

Complete list of commands to test, organized by API type. Update this when commands are added or removed.

---

## Product API Commands (Ably SDK)

These commands use the Ably SDK (REST or Realtime) and authenticate via API key.

### Channels (`ably channels`)

#### Top-Level Commands
| Command | Type | Description |
|---------|------|-------------|
| `channels subscribe <channel...>` | Subscribe (long-running) | Subscribe to messages on one or more channels |
| `channels publish <channel> <message>` | Publish (one-shot/batch) | Publish a message to a channel |
| `channels history <channel>` | History (paginated) | Retrieve message history for a channel |
| `channels list` | List (paginated) | List active channels |
| `channels inspect <channel>` | Get (one-shot) | Open dashboard to inspect a channel |
| `channels batch-publish` | Publish (batch) | Publish messages to multiple channels |
| `channels append <channel>` | REST mutation | Append data to a message |
| `channels delete <channel>` | REST mutation | Delete a message |
| `channels update <channel>` | REST mutation | Update a message |

#### Presence Subcommands (`ably channels presence`)
| Command | Type | Description |
|---------|------|-------------|
| `channels presence enter <channel>` | Enter/Hold (long-running) | Enter presence on a channel |
| `channels presence get <channel>` | Get (one-shot) | Get current presence members |
| `channels presence subscribe <channel>` | Subscribe (long-running) | Subscribe to presence changes |

#### Occupancy Subcommands (`ably channels occupancy`)
| Command | Type | Description |
|---------|------|-------------|
| `channels occupancy get <channel>` | Get (one-shot) | Get occupancy metrics |
| `channels occupancy subscribe <channel>` | Subscribe (long-running) | Subscribe to occupancy changes |

#### Annotations Subcommands (`ably channels annotations`)
| Command | Type | Description |
|---------|------|-------------|
| `channels annotations publish <channel>` | Publish | Publish annotation on a message |
| `channels annotations subscribe <channel>` | Subscribe (long-running) | Subscribe to annotation events |
| `channels annotations get <channel>` | Get (one-shot) | Get annotations for a message |
| `channels annotations delete <channel>` | REST mutation | Delete an annotation |

---

### Rooms (`ably rooms`)

#### Top-Level Commands
| Command | Type | Description |
|---------|------|-------------|
| `rooms list` | List (paginated) | List active chat rooms |

#### Messages Subcommands (`ably rooms messages`)
| Command | Type | Description |
|---------|------|-------------|
| `rooms messages send <room> <message>` | Send (one-shot) | Send a message to a room |
| `rooms messages subscribe <room...>` | Subscribe (long-running) | Subscribe to messages in a room |
| `rooms messages history <room>` | History (paginated) | Get message history for a room |
| `rooms messages delete <room>` | REST mutation | Delete a message |
| `rooms messages update <room>` | REST mutation | Update a message |

#### Message Reactions Subcommands (`ably rooms messages reactions`)
| Command | Type | Description |
|---------|------|-------------|
| `rooms messages reactions send <room>` | Send | Send a reaction to a message |
| `rooms messages reactions remove <room>` | REST mutation | Remove a reaction |
| `rooms messages reactions subscribe <room>` | Subscribe (long-running) | Subscribe to reaction changes |

#### Presence Subcommands (`ably rooms presence`)
| Command | Type | Description |
|---------|------|-------------|
| `rooms presence enter <room>` | Enter/Hold (long-running) | Enter presence in a room |
| `rooms presence get <room>` | Get (one-shot) | Get presence members |
| `rooms presence subscribe <room>` | Subscribe (long-running) | Subscribe to presence changes |

#### Occupancy Subcommands (`ably rooms occupancy`)
| Command | Type | Description |
|---------|------|-------------|
| `rooms occupancy get <room>` | Get (one-shot) | Get room occupancy metrics |
| `rooms occupancy subscribe <room>` | Subscribe (long-running) | Subscribe to occupancy changes |

#### Reactions Subcommands (`ably rooms reactions`)
| Command | Type | Description |
|---------|------|-------------|
| `rooms reactions send <room>` | Send | Send a room-level reaction |
| `rooms reactions subscribe <room>` | Subscribe (long-running) | Subscribe to room reactions |

#### Typing Subcommands (`ably rooms typing`)
| Command | Type | Description |
|---------|------|-------------|
| `rooms typing keystroke <room>` | Send | Send a typing indicator |
| `rooms typing subscribe <room>` | Subscribe (long-running) | Subscribe to typing indicators |

---

### Spaces (`ably spaces`)

#### Top-Level Commands
| Command | Type | Description |
|---------|------|-------------|
| `spaces create <space>` | Create (one-shot) | Create a space |
| `spaces get <space>` | Get (one-shot) | Get space details |
| `spaces list` | List (paginated) | List spaces |
| `spaces subscribe <space>` | Subscribe (long-running) | Subscribe to space events |

#### Members Subcommands (`ably spaces members`)
| Command | Type | Description |
|---------|------|-------------|
| `spaces members enter <space>` | Enter/Hold (long-running) | Enter a space as a member |
| `spaces members get <space>` | Get (one-shot) | Get current space members |
| `spaces members subscribe <space>` | Subscribe (long-running) | Subscribe to member changes |

#### Locations Subcommands (`ably spaces locations`)
| Command | Type | Description |
|---------|------|-------------|
| `spaces locations set <space>` | Set/Hold (long-running) | Set location in a space |
| `spaces locations get <space>` | Get (one-shot) | Get member locations |
| `spaces locations subscribe <space>` | Subscribe (long-running) | Subscribe to location changes |

#### Locks Subcommands (`ably spaces locks`)
| Command | Type | Description |
|---------|------|-------------|
| `spaces locks acquire <space> <lock>` | Acquire/Hold (long-running) | Acquire a lock in a space |
| `spaces locks get <space>` | Get (one-shot) | Get locks in a space |
| `spaces locks subscribe <space>` | Subscribe (long-running) | Subscribe to lock changes |

#### Cursors Subcommands (`ably spaces cursors`)
| Command | Type | Description |
|---------|------|-------------|
| `spaces cursors set <space>` | Set/Hold (long-running) | Set cursor position in a space |
| `spaces cursors get <space>` | Get (one-shot) | Get cursor positions |
| `spaces cursors subscribe <space>` | Subscribe (long-running) | Subscribe to cursor changes |

#### Occupancy Subcommands (`ably spaces occupancy`)
| Command | Type | Description |
|---------|------|-------------|
| `spaces occupancy get <space>` | Get (one-shot) | Get space occupancy metrics |
| `spaces occupancy subscribe <space>` | Subscribe (long-running) | Subscribe to occupancy changes |

---

### Logs (`ably logs`)

#### Top-Level Commands
| Command | Type | Description |
|---------|------|-------------|
| `logs subscribe` | Subscribe (long-running) | Subscribe to all log events |
| `logs history` | History (paginated) | Get log history |

#### Channel Lifecycle (`ably logs channel-lifecycle`)
| Command | Type | Description |
|---------|------|-------------|
| `logs channel-lifecycle subscribe` | Subscribe (long-running) | Subscribe to channel lifecycle events |

#### Connection Lifecycle (`ably logs connection-lifecycle`)
| Command | Type | Description |
|---------|------|-------------|
| `logs connection-lifecycle subscribe` | Subscribe (long-running) | Subscribe to connection lifecycle events |
| `logs connection-lifecycle history` | History (paginated) | Get connection lifecycle history |

#### Push Logs (`ably logs push`)
| Command | Type | Description |
|---------|------|-------------|
| `logs push subscribe` | Subscribe (long-running) | Subscribe to push notification logs |
| `logs push history` | History (paginated) | Get push notification log history |

---

### Connections (`ably connections`)
| Command | Type | Description |
|---------|------|-------------|
| `connections test` | One-shot | Test connection to Ably |

---

### Bench (`ably bench`)
| Command | Type | Description |
|---------|------|-------------|
| `bench publisher` | Long-running | Benchmark publish throughput |
| `bench subscriber` | Long-running | Benchmark subscribe throughput |

---

## Control API Commands (HTTP)

These commands use the Ably Control API via HTTP and authenticate via access token.

### Accounts (`ably accounts`)
| Command | Type | Description |
|---------|------|-------------|
| `accounts login` | Auth flow | Log in to an Ably account |
| `accounts logout` | Auth flow | Log out of current account |
| `accounts current` | Get (one-shot) | Show current account info |
| `accounts list` | List | List configured accounts |
| `accounts switch` | Config | Switch between accounts |

### Apps (`ably apps`)
| Command | Type | Description |
|---------|------|-------------|
| `apps create` | Create | Create a new app |
| `apps current` | Get (one-shot) | Show current app |
| `apps list` | List | List apps in account |
| `apps update` | Update | Update app settings |
| `apps delete` | Delete (destructive) | Delete an app |
| `apps switch` | Config | Switch between apps |

#### Channel Rules (`ably apps channel-rules`)
| Command | Type | Description |
|---------|------|-------------|
| `apps channel-rules create` | Create | Create a channel rule |
| `apps channel-rules list` | List | List channel rules |
| `apps channel-rules update` | Update | Update a channel rule |
| `apps channel-rules delete` | Delete (destructive) | Delete a channel rule |

#### Integration Rules (`ably apps rules`)
| Command | Type | Description |
|---------|------|-------------|
| `apps rules create` | Create | Create an integration rule |
| `apps rules list` | List | List integration rules |
| `apps rules update` | Update | Update an integration rule |
| `apps rules delete` | Delete (destructive) | Delete an integration rule |

### Auth (`ably auth`)
| Command | Type | Description |
|---------|------|-------------|
| `auth issue-ably-token` | Create | Issue an Ably token |
| `auth issue-jwt-token` | Create | Issue a JWT token |
| `auth revoke-token` | Delete | Revoke a token |

#### Keys (`ably auth keys`)
| Command | Type | Description |
|---------|------|-------------|
| `auth keys create` | Create | Create an API key |
| `auth keys current` | Get (one-shot) | Show current key |
| `auth keys get <key-id>` | Get (one-shot) | Get key details |
| `auth keys list` | List | List API keys |
| `auth keys revoke <key-id>` | Delete (destructive) | Revoke a key |
| `auth keys switch` | Config | Switch between keys |
| `auth keys update <key-id>` | Update | Update key capabilities |

### Queues (`ably queues`)
| Command | Type | Description |
|---------|------|-------------|
| `queues create` | Create | Create a queue |
| `queues list` | List | List queues |
| `queues delete` | Delete (destructive) | Delete a queue |

### Integrations (`ably integrations`)
| Command | Type | Description |
|---------|------|-------------|
| `integrations create` | Create | Create an integration |
| `integrations get <id>` | Get (one-shot) | Get integration details |
| `integrations list` | List | List integrations |
| `integrations update <id>` | Update | Update an integration |
| `integrations delete <id>` | Delete (destructive) | Delete an integration |

### Channel Rules (`ably channel-rule`) — alias
| Command | Type | Description |
|---------|------|-------------|
| `channel-rule create` | Create | Create a channel rule (alias) |
| `channel-rule list` | List | List channel rules (alias) |
| `channel-rule update` | Update | Update a channel rule (alias) |
| `channel-rule delete` | Delete (destructive) | Delete a channel rule (alias) |

### Push (`ably push`)
| Command | Type | Description |
|---------|------|-------------|
| `push publish` | Publish | Send a push notification |
| `push batch-publish` | Publish (batch) | Send push notifications in batch |

#### Push Channels (`ably push channels`)
| Command | Type | Description |
|---------|------|-------------|
| `push channels list` | List | List push channels |
| `push channels list-channels` | List | List push channels (alternate) |
| `push channels save` | Create/Update | Save a push channel subscription |
| `push channels remove` | Delete | Remove a push channel subscription |
| `push channels remove-where` | Delete (bulk) | Remove push channels matching criteria |

#### Push Devices (`ably push devices`)
| Command | Type | Description |
|---------|------|-------------|
| `push devices get <id>` | Get (one-shot) | Get device details |
| `push devices list` | List | List registered devices |
| `push devices save` | Create/Update | Register/update a device |
| `push devices remove` | Delete | Remove a device |
| `push devices remove-where` | Delete (bulk) | Remove devices matching criteria |

#### Push Config (`ably push config`)
| Command | Type | Description |
|---------|------|-------------|
| `push config show` | Get (one-shot) | Show push config |
| `push config set-apns` | Update | Configure APNS |
| `push config set-fcm` | Update | Configure FCM |
| `push config clear-apns` | Delete | Clear APNS config |
| `push config clear-fcm` | Delete | Clear FCM config |

### Stats (`ably stats`)
| Command | Type | Description |
|---------|------|-------------|
| `stats app` | Get (one-shot) | Get app-level stats |
| `stats account` | Get (one-shot) | Get account-level stats |

---

## Local / Utility Commands

These commands don't call external APIs or have mixed behavior.

| Command | Type | Description |
|---------|------|-------------|
| `login` | Auth flow | Alias for `accounts login` |
| `version` | Local | Display CLI version |
| `status` | Local | Show current config status |
| `config path` | Local | Show config file path |
| `config show` | Local | Show current config |
| `support ask` | External | Ask Ably support a question |
| `support contact` | External | Contact Ably support |
| `interactive` | Interactive | Launch interactive mode |
| `help` | Local | Show help |
| `test wait` | Test utility | Wait for a duration (internal) |

---

## Testing Priority Order

### Phase 1: Core Workflows (subscribe + publish)
1. `channels subscribe` + `channels publish`
2. `rooms messages subscribe` + `rooms messages send`

### Phase 2: History and Query
3. `channels history`
4. `rooms messages history`
5. `channels list`
6. `rooms list`

### Phase 3: Presence
7. `channels presence enter` + `channels presence get` + `channels presence subscribe`
8. `rooms presence enter` + `rooms presence get` + `rooms presence subscribe`

### Phase 4: Spaces
9. `spaces members enter` + `spaces members get` + `spaces members subscribe`
10. `spaces locations set` + `spaces locations get` + `spaces locations subscribe`
11. `spaces locks acquire` + `spaces locks get` + `spaces locks subscribe`
12. `spaces cursors set` + `spaces cursors get` + `spaces cursors subscribe`

### Phase 5: Occupancy
13. `channels occupancy get` + `channels occupancy subscribe`
14. `rooms occupancy get` + `rooms occupancy subscribe`
15. `spaces occupancy get` + `spaces occupancy subscribe`

### Phase 6: Mutations and Specialized
16. `channels append` / `channels update` / `channels delete`
17. `rooms messages update` / `rooms messages delete`
18. `channels batch-publish`
19. `channels annotations` (all subcommands)

### Phase 7: Rooms Extras
20. `rooms reactions send` + `rooms reactions subscribe`
21. `rooms messages reactions send` + `rooms messages reactions remove` + `rooms messages reactions subscribe`
22. `rooms typing keystroke` + `rooms typing subscribe`

### Phase 8: Logs
23. `logs subscribe` + `logs history`
24. `logs channel-lifecycle subscribe`
25. `logs connection-lifecycle subscribe` + `logs connection-lifecycle history`
26. `logs push subscribe` + `logs push history`

### Phase 9: Control API (CRUD)
27. `apps create` + `apps list` + `apps update` + `apps delete`
28. `auth keys create` + `auth keys list` + `auth keys get` + `auth keys update` + `auth keys revoke`
29. `queues create` + `queues list` + `queues delete`
30. `integrations create` + `integrations list` + `integrations get` + `integrations update` + `integrations delete`

### Phase 10: Stats and Utilities
31. `stats app` + `stats account`
32. `connections test`
33. `version` + `status` + `config show` + `config path`
