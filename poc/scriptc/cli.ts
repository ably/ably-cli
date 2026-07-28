import { BaseRest, Rest, FetchRequest } from "ably/modular";

const VERSION = "1.2.1";

const ESC = String.fromCharCode(27);
const GREEN = ESC + "[32m";
const CYAN = ESC + "[36m";
const DIM = ESC + "[2m";
const RESET = ESC + "[0m";

// ---- tiny static arg parser (compiles to native code, no engine) ----
type Parsed = {
  positional: string[];
  flags: Map<string, string>;
  bools: Map<string, string>;
};

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  const bools = new Map<string, string>();
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags.set(a.slice(2, eq), a.slice(eq + 1));
      } else {
        const name = a.slice(2);
        if (
          name === "json" ||
          name === "pretty-json" ||
          name === "help" ||
          name === "version"
        ) {
          bools.set(name, "true");
        } else if (i + 1 < argv.length) {
          flags.set(name, argv[i + 1]);
          i = i + 1;
        } else {
          bools.set(name, "true");
        }
      }
    } else {
      positional.push(a);
    }
    i = i + 1;
  }
  return { positional: positional, flags: flags, bools: bools };
}

function getFlag(p: Parsed, name: string): string {
  const v = p.flags.get(name);
  return v === undefined ? "" : v;
}

function apiKey(p: Parsed): string {
  const fromFlag = getFlag(p, "api-key");
  if (fromFlag.length > 0) return fromFlag;
  const env = process.env["ABLY_API_KEY"];
  if (env === undefined || env.length === 0) {
    console.error("No API key. Set ABLY_API_KEY or pass --api-key.");
    process.exit(1);
  }
  return env;
}

function client(p: Parsed): BaseRest {
  // Mirrors the real CLI's hidden --port/--tls escape hatches, so the POC can
  // be pointed at a local endpoint.
  const host = getFlag(p, "rest-host");
  if (host.length > 0) {
    const portStr = getFlag(p, "port");
    return new BaseRest({
      key: apiKey(p),
      restHost: host,
      port: portStr.length > 0 ? parseInt(portStr, 10) : 80,
      tls: false,
      plugins: { Rest, FetchRequest },
    });
  }
  return new BaseRest({ key: apiKey(p), plugins: { Rest, FetchRequest } });
}

const HELP = [
  "ably - Ably CLI (native proof of concept)",
  "",
  "USAGE",
  "  $ ably <command> [args] [flags]",
  "",
  "COMMANDS",
  "  channels publish <channel> <message>   Publish a message to a channel",
  "  channels history <channel>             Retrieve message history for a channel",
  "  time                                   Get the Ably service time",
  "",
  "FLAGS",
  "  --api-key <key>   Ably API key (or set ABLY_API_KEY)",
  "  --name <name>     Event name for publish",
  "  --limit <n>       Max results for history",
  "  --json            Output as JSON",
  "  --version         Show version",
  "  --help            Show this help",
].join("\n");

async function cmdPublish(p: Parsed): Promise<void> {
  if (p.positional.length < 4) {
    console.error("Usage: ably channels publish <channel> <message>");
    process.exit(1);
  }
  const channelName = p.positional[2];
  const messageText = p.positional[3];
  const eventName = getFlag(p, "name");
  const c = client(p);
  const ch = c.channels.get(channelName);
  if (eventName.length > 0) {
    await ch.publish(eventName, messageText);
  } else {
    await ch.publish({ data: messageText });
  }
  if (p.bools.has("json")) {
    console.log(
      '{"type":"result","command":"channels publish","success":true,"channel":"' +
        channelName +
        '"}',
    );
  } else {
    console.log(
      GREEN +
        "✔" +
        RESET +
        " Message published to channel " +
        CYAN +
        channelName +
        RESET +
        ".",
    );
  }
}

async function cmdHistory(p: Parsed): Promise<void> {
  if (p.positional.length < 3) {
    console.error("Usage: ably channels history <channel>");
    process.exit(1);
  }
  const channelName = p.positional[2];
  const limitStr = getFlag(p, "limit");
  const limit = limitStr.length > 0 ? parseInt(limitStr, 10) : 10;
  const c = client(p);
  const ch = c.channels.get(channelName);
  const page = await ch.history({ limit: limit });
  const items = page.items;
  if (p.bools.has("json")) {
    // Normalise the SDK's `any`-typed message fields into a typed record
    // before serialising, so the whole path stays statically compiled.
    const messages: { name: string; data: string }[] = [];
    let j = 0;
    while (j < items.length) {
      messages.push({ name: `${items[j].name}`, data: `${items[j].data}` });
      j = j + 1;
    }
    console.log(
      JSON.stringify({
        type: "result",
        command: "channels history",
        success: true,
        messages: messages,
      }),
    );
  } else {
    let idx = 0;
    while (idx < items.length) {
      const m = items[idx];
      const name = `${m.name}`;
      const data = `${m.data}`;
      console.log(DIM + "[" + (idx + 1) + "]" + RESET + " " + name + ": " + data);
      idx = idx + 1;
    }
    console.log(CYAN + items.length + RESET + " messages");
  }
}

async function cmdTime(p: Parsed): Promise<void> {
  const c = client(p);
  const t = await c.time();
  console.log("Ably service time: " + t);
}

async function main(): Promise<void> {
  const argv: string[] = [];
  let i = 2;
  while (i < process.argv.length) {
    argv.push(process.argv[i]);
    i = i + 1;
  }
  const p = parseArgs(argv);

  if (p.bools.has("version")) {
    console.log("@ably/cli/" + VERSION + " native");
    return;
  }
  if (p.bools.has("help") || p.positional.length === 0) {
    console.log(HELP);
    return;
  }

  const topic = p.positional[0];
  if (topic === "time") {
    await cmdTime(p);
    return;
  }
  if (topic === "channels" && p.positional.length > 1) {
    const sub = p.positional[1];
    if (sub === "publish") {
      await cmdPublish(p);
      return;
    }
    if (sub === "history") {
      await cmdHistory(p);
      return;
    }
  }
  console.error("Command not found. Run 'ably --help'.");
  process.exit(127);
}

main();
