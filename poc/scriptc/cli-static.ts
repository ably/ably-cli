
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


const HELP = [
  "ably - Ably CLI (native proof of concept)",
  "",
  "USAGE",
  "  $ ably <command> [args] [flags]",
].join("\n");

async function main(): Promise<void> {
  const argv: string[] = [];
  let i = 2;
  while (i < process.argv.length) { argv.push(process.argv[i]); i = i + 1; }
  const p = parseArgs(argv);
  if (p.bools.has("version")) { console.log("@ably/cli/" + VERSION + " native"); return; }
  if (p.bools.has("help") || p.positional.length === 0) { console.log(HELP); return; }
  console.error("Command not found.");
  process.exit(127);
}
main();
