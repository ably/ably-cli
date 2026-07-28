# scriptc proof of concept

Investigation into whether [`scriptc`](https://github.com/vercel-labs/scriptc) —
Vercel Labs' TypeScript-to-native compiler — could compile the Ably CLI into a
fast-starting native binary.

**This is a research spike, not shipping code.** Nothing here is wired into the
build, tested in CI, or exported from the package.

## Summary

Compiling the **existing oclif CLI** with scriptc is **not possible today**. Two
independent blockers, both in scriptc, both fundamental rather than cosmetic.

Compiling a **purpose-built CLI** that uses the Ably SDK **works today**, and is
between 5x and 163x faster to start depending on whether the SDK is loaded.

## Measured results

All figures from this container (Linux x64, Node v22.22.2, clang 18), median of
10–20 runs. `bench.py` is the harness.

### Baseline — the current CLI

| Command | Median |
|---|---|
| `ably --version` | 246 ms |
| `ably --help` | 552 ms |
| `ably channels publish --help` | 562 ms |
| bare `node -e ""` | 38 ms |

Of that, importing the `ably` SDK alone costs **168 ms** and `@oclif/core`
another **85 ms**.

### The proof of concept

| Build | Size | `--version` | vs current CLI |
|---|---|---|---|
| `cli-static.ts` — 100% static, no SDK | 388 KB | **1.5 ms** | **163x faster** |
| `cli.ts` — Ably SDK embedded (`--dynamic`) | 2.6 MB | **50 ms** | **4.9x faster** |
| current oclif CLI on Node | ~200 MB `node_modules` + Node | 246 ms | — |

For reference, `/bin/true` measures 1.3 ms in the same harness — the static
build is at the floor of what a process can cost.

The 49 ms gap between the two builds is the embedded JavaScript engine parsing
and evaluating the Ably SDK's 364 KB of JS at startup. It is paid on every
invocation that imports the SDK, including `--version`. Still less than a third
of Node's 168 ms for the same import.

## What works

`cli.ts` is a real, working native binary. Verified end-to-end against a local
Ably-shaped endpoint (`mock-ably.mjs`): it parses arguments in native code,
constructs a real `BaseRest` client, makes real HTTP requests over scriptc's own
network stack, and publishes messages the server receives in correct Ably wire
format.

```
$ ./ably-native channels publish my-channel "Hello from native binary" --name greeting
[mock-ably] received publish: [{"name":"greeting","data":"Hello from native binary","id":"WYbLioKXnJu1:0","action":0,"size":32}]
✔ Message published to channel my-channel.

$ ./ably-native channels history my-channel --json
{"type":"result","command":"channels history","success":true,"messages":[...]}
```

`scriptc coverage` reports **85% of statements compile statically**; the
remaining 15% are the SDK calls, which run in the embedded engine.

### The critical detail: use `ably/modular`, not `ably`

The default `ably` import resolves to the `node` export condition
(`build/ably-node.js`), which requires `got` → `http2-wrapper` → `node:http2`.
**`node:http2` is not shimmed by scriptc**, and it is reached at import time, so
the binary dies immediately:

```
Uncaught Error: the island does not provide the 'node:http2' builtin
```

`ably/modular` with the `FetchRequest` plugin has **zero external requires** and
uses `fetch`, which scriptc implements natively over its own TLS stack. That
path reports *"no remaining blockers"* and works.

## What does not work

### 1. `SC1090` — cannot extend classes from npm packages

```
error SC1090: extending classes not declared in the program ('Command') is not supported yet

  export class Hello extends Command {
                             ^~~~~~~
```

Every Ably CLI command extends `Command` from `@oclif/core`, via
`AblyBaseCommand` / `ControlBaseCommand` / `ChatBaseCommand` /
`SpacesBaseCommand` / `StatsBaseCommand`. That is **all 135 command classes** —
100% of the surface. There is no workaround short of not using oclif.

### 2. Command discovery needs runtime `import()`

oclif resolves commands by globbing the filesystem and dynamically importing the
matching module. scriptc embeds its module graph at **build time**; a runtime
`import()` of a computed path is a "lazy trap" that throws.

A minimal oclif CLI compiled with `--dynamic` demonstrates this precisely — the
framework boots and prints its own help, but cannot find any command:

```
$ ./mini --help
VERSION
  mini-cli/1.0.0 linux-x64 node-v24.0.0
USAGE
  $ mini [COMMAND]

$ ./mini hello
 ›   Error: command hello not found
```

oclif's `strategy: "explicit"` does not rescue this, because the command classes
still hit blocker 1.

Encouragingly, every Node builtin `@oclif/core` needs **is** shimmed
(`child_process`, `fs`, `fs/promises`, `os`, `path`, `perf_hooks`, `readline`,
`tty`, `url`, `util`). oclif is blocked on language features, not platform gaps.

### 3. Realtime / WebSocket is unavailable

scriptc's runtime provides `net`/`http`/`https`/`tls`/`fetch` but **no
WebSocket**. `ably/modular`'s `WebSocketTransport` looks for a global
`WebSocket` and finds none:

```
Ably: realtime.ConnectionManager(): no requested transports available
```

The `ws` package itself embeds and runs correctly in the island — it constructs
a socket and attempts a real connection — so the missing piece is only the
global. But the polyfill cannot be written, because `globalThis` has no
lowering:

```
error SC2020: 'globalThis' is part of the standard library types but has no scriptc lowering yet
```

This blocks every `subscribe`, `presence`, Spaces and Chat command — a large
fraction of the CLI's value.

### Other constraints found

- `--dynamic` binaries **cannot be cross-compiled** — the engine archive is
  host-native, so each target platform needs its own build machine.
- Static-tier `fetch` is incomplete: `Response.status` and `Response.text` have
  no lowering yet (`SC2020`). Only the island's `fetch` is usable today.
- `process.argv[2]` on a missing argument **aborts the process** rather than
  yielding `undefined` — scriptc arrays are dense. Argument handling needs
  explicit length checks.
- Ably's `message.data` is `any`; it must be normalised (template literal or
  checked cast) before `JSON.stringify` or the statement falls out of the
  static tier.
- `--dynamic` forces the C backend (`llvm refused: npmEmbedding`).
- Build times: 8 s static, 13–53 s with the SDK embedded.

## Reproducing

```bash
npm install -g scriptc          # v0.0.17 used here; needs clang
npm install ably                # in this directory

scriptc coverage cli.ts --dynamic     # 85% static, no blockers
scriptc build    cli.ts --dynamic -o ably-native
scriptc build    cli-static.ts -o ably-static   # 100% static, 388 KB

node mock-ably.mjs &
ABLY_API_KEY="poc.key:secret" ./ably-native \
  channels publish my-channel "Hello" --rest-host 127.0.0.1 --port 8765
```

`bench.py` provides the `bench(label, cmd)` helper used for all timings above.
