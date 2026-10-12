# Client Identity and MAU Classification

Ably bills monthly active users (MAU) per distinct client ID on **device** traffic; **server** traffic is exempt from MAU counting, from the per-client-ID connection cap, and from the requirement to carry a client ID. This page describes how the CLI declares its own traffic and which client ID it acts as. Design rationale: DXRFC-029 (CLI Classification and Identity for MAU Pricing).

## Always a server

The CLI always connects as a server. Every Pub/Sub client is built with `@ably/pubsub-server`, whatever the CLI authenticates with, and Chat and Spaces wrap that same client, so rooms and spaces traffic is server traffic too.

With an API key (`ably login`, `ABLY_API_KEY`) that is all Ably needs. Under token auth (`ABLY_TOKEN`) Ably grants the server side only through a signed `x-ably-clientType=server` claim on the token, and rejects a client that declares itself a server without it. Native Ably tokens cannot carry the claim, so use a JWT issued with:

```bash
ably auth issue-jwt-token --client-type server --client-id backend-worker
```

## Which client ID the CLI acts as

Under API key auth, the client ID is resolved once per process, from the first of:

1. `--client-id <id>`, on commands that offer it
2. `ABLY_CLIENT_ID`
3. `client.id` in the config file (`~/.ably/config`)
4. A default generated once per install (`ably-cli-<8 hex chars>`) and saved as `client.defaultId` in the config

Every client the command builds, every command in an interactive session, and every token minted by `ably auth issue-ably-token` / `issue-jwt-token` without `--client-id` uses that one ID. Commands without a `--client-id` flag still act as it. `ably bench` commands append a per-process suffix to the default, so that many concurrent bench processes stay under the per-client-ID connection cap.

To give a machine or CI job a fixed identity, set it once:

```bash
export ABLY_CLIENT_ID="deploy-bot"
```

or in the config file:

```toml
[client]
id = "deploy-bot"
```

Values the CLI refuses:

- `""` — an empty client ID. It used to fall back silently to a random ID.
- `"*"` — the wildcard. The CLI acts as, and issues tokens to, one concrete client ID.
- `"none"` — deprecated. It still acts with no client ID, with a warning, but apps that require identified clients reject that traffic.

Under token auth the client ID is the token's and is never overridden; `--client-id` is ignored with a warning. A JWT without an `x-ably-clientId` claim is rejected before connecting.

### Target client IDs are not identity

On push and token commands, `--client-id` names a *target* rather than the CLI's identity: `ably push devices list --client-id user123` lists that user's devices, and `ably auth issue-jwt-token --client-id alice` issues a token to alice. These never change who the CLI acts as.

## Simulating multiple users

An explicit `--client-id` always wins, so two terminals can act as two different clients:

```bash
# Terminal 1
ably channels presence enter my-channel --client-id alice

# Terminal 2
ably channels presence enter my-channel --client-id bob
```

Both connect as servers, so they are not counted or capped as devices. Ably counts client IDs wherever they appear, including in message payloads, so each simulated name may still register as an MAU. The CLI cannot reproduce device behaviour (MAU counting, the per-client-ID connection cap, identified-client enforcement); use an Ably SDK on the device side for that.

## When something goes wrong

- Rejections about the client ID (`40012`, `40161`, `91000`) carry a hint for how you authenticated: set `--client-id` / `ABLY_CLIENT_ID` under API key auth, or re-issue the token with a client ID under token auth.
- A long-running command whose connection fails, or keeps dropping without staying connected, exits non-zero instead of reporting success.
