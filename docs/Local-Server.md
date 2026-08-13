# Local Servers

The CLI can target a locally-running Ably server instead of the managed service. A local server is stored as an ordinary account profile, so `ably accounts list`, `ably accounts current` and `ably accounts switch` all work as usual and every data plane command runs unchanged.

---

## Getting started

The guided flow prompts for everything it needs:

```bash
ably accounts login --local
```

It asks for:

1. **Data plane URL** — defaults to `http://localhost:8081`
2. **API key** — for a key you already hold on the server (input is masked)
3. **Whether the control plane is also running locally** — and if so, its URL and a Control API access token

The explicit form skips the prompts and is what you want in scripts:

```bash
# Data plane only
ably accounts login --local --url http://localhost:8081

# Data plane and control plane
ably accounts login --local \
  --url http://localhost:8081 \
  --control-url http://localhost:8082
```

Passing `--url` disables the prompts for the data plane URL and the control plane question; the API key and Control API token still prompt unless supplied via the environment (see [Non-interactive use](#non-interactive-use)).

Once logged in, everything works as it does against the managed service:

```bash
ably channels publish my-channel "hello"
ably channels subscribe my-channel
ably accounts switch production   # back to a managed account
ably accounts switch local        # and back again
```

---

## URLs

Both `--url` and `--control-url` take a full URL. A missing scheme defaults to `http` for loopback hosts (`localhost`, `127.0.0.1`, `::1`) and `https` for everything else, so `--url localhost:8081` and `--url http://localhost:8081` are equivalent.

The data plane URL must not include a path: Ably routes by hostname, so a path would be silently discarded. The control plane URL may include one — if it does, it is used verbatim as the API prefix; if it does not, `/v1` is appended (matching the dedicated Control API service).

Embedded credentials, query strings and fragments are rejected for the same reason a path is: nothing downstream carries them, and dropping them silently would resurface later as an unrelated auth or routing error.

Internally the data plane URL is decomposed into the SDK's `endpoint`, `port`/`tlsPort` and `tls` client options and stored on the account, which is why you do not need to repeat host or port flags on individual commands.

---

## The API key is the only data plane credential

There is no OAuth flow and no account directory on a local server. The app ID is read from the API key itself (`<appId>.<keyId>:<keySecret>`), so the key is the only thing you need to supply for the data plane to work.

The key is validated for shape at login. A key without the `<appId>.<keyId>:<keySecret>` structure is rejected with a message rather than being stored and failing later.

---

## Running only the data plane

Running the control plane locally is optional. When you log in without `--control-url`, control plane commands (`ably apps`, `ably auth keys`, `ably integrations`, `ably queues`, `ably stats`) fail immediately with:

```
Control API commands aren't available for local server "local" because it was configured without a control plane URL.
Re-run "ably accounts login --local" with --control-url if you are running the control plane locally, set ABLY_CONTROL_HOST to send just this command to a hosted control plane, or switch to a managed account with "ably accounts switch".
```

This is deliberate: without the guard those commands would silently query the managed Control API at `control.ably.net` while a local profile is selected.

To add a control plane later, re-run `ably accounts login --local` with `--control-url`. To reach a hosted control plane for a single command without leaving the local profile, set `ABLY_CONTROL_HOST` (with `ABLY_ACCESS_TOKEN` for a token it will accept).

`ably accounts current` does not need a control plane: for a local profile without one it reports what is stored, rather than treating the absent control plane as an expired token.

---

## Knowing which server you are on

Every command that talks to a non-default server says so in the "Using:" banner, as a URL:

```
$ ably channels publish my-channel "hello"
Using: Account=dev • Endpoint=http://localhost:8081 • App=localapp • Key=Local Key (localapp.keyid)
```

The `Endpoint=` field is the server the command will actually reach, so a command run against localhost never looks identical to the same command run against production. It is omitted only for a managed account on Ably's own endpoints, where there is nothing to state. Control plane commands (`ably apps`, `ably auth keys`, …) show the control plane URL rather than the data plane one, since that is where their requests go.

The same URL is reported by every command that describes an account:

```
$ ably accounts current
Account: dev
Endpoint: http://localhost:8081
Control plane: http://localhost:8082
Apps configured: 1
Current App: localapp

$ ably accounts list
▶ Account: dev (current)
  Endpoint: http://localhost:8081
  Control plane: http://localhost:8082
  Apps configured: 1
  Current app: localapp (localapp)

$ ably accounts switch dev
✓ Switched to local server dev (http://localhost:8081).
```

With `--json`, the same routing is carried under a `dataPlane` object (`endpoint`, `port`, `tls`, `url`) alongside `controlUrl`, in the same shape from `accounts login --local`, `accounts current`, `accounts list` and `accounts switch`.

An environment variable that redirects a command away from its profile shows up the same way, since the banner always names the effective target:

```
$ export ABLY_ENDPOINT=other.example.com
$ ably channels publish my-channel "hello"
Using: Account=dev • Endpoint=http://other.example.com:8081 • App=…
```

Note that `ABLY_ENDPOINT` replaces only the host — the port and TLS setting still come from the profile, which is why the displayed URL is the combination that traffic will actually use. On control plane commands the equivalent override is `ABLY_CONTROL_HOST`.

---

## Aliases

Local logins default to the alias `local`, and the alias becomes the profile's account name — a local server has no server-side identity to name it by. Re-running against a different URL updates that profile in place and warns you first. Use `--alias` to keep several servers side by side:

```bash
ably accounts login --local --url http://localhost:8081 --alias dev
ably accounts login --local --url http://localhost:9091 --alias staging-local
ably accounts switch dev
```

---

## Non-interactive use

With `--json` the CLI cannot prompt, so credentials must come from the environment and `--url` is required:

```bash
export ABLY_API_KEY="localapp.keyid:keysecret"
export ABLY_ACCESS_TOKEN="local-control-token"   # only if using --control-url

ably accounts login --local --url http://localhost:8081 --json
```

`ABLY_API_KEY` and `ABLY_ACCESS_TOKEN` are also used in place of the prompts in interactive mode when they are set.

---

## Without a profile

If you do not want to store anything, two environment variables are enough:

```bash
ABLY_URL=http://localhost:8081 \
ABLY_API_KEY=appId.keyId:keySecret \
  ably channels publish my-channel "hello"
```

`ABLY_URL` sets host, port and TLS in one value. The scheme is optional for loopback hosts, so `ABLY_URL=localhost:8081` is equivalent. A path is rejected rather than silently discarded, since Ably routes by host.

The same value is available as a flag, for a single command rather than a whole shell:

```bash
ably channels publish my-channel "hello" --url http://localhost:8081
```

### Precedence

For the data plane, the first source that supplies routing wins:

```
--url  >  ABLY_URL  >  ABLY_ENDPOINT  >  profile  >  SDK default
```

`--port`, `--tls-port` and `--tls` are applied on top of whichever source won, so they can override a single field — `--url http://localhost:8081 --port 1234` targets `localhost:1234`.

`ABLY_ENDPOINT` predates the URL forms and sets the **host only**, keeping the port and TLS setting from the profile. Prefer `ABLY_URL` unless you specifically want that behaviour.

`--url`, `--port`, `--tls-port` and `--tls` are hidden from `--help` by default; set `ABLY_SHOW_DEV_FLAGS=true` to show them.

---

## Related

- [Environment Variables — General Usage](Environment-Variables/General-Usage.md)
- [Project Structure](Project-Structure.md)
