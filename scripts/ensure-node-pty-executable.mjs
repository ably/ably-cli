// Ensure node-pty's prebuilt `spawn-helper` is executable.
//
// node-pty ships prebuilt binaries under `prebuilds/<platform>-<arch>/` and at
// runtime execs `<prebuild dir>/spawn-helper`. pnpm does not preserve the
// execute bit when it extracts the package into its store, and node-pty's own
// post-install only fixes files under `build/Release/` (which prebuild installs
// don't create). The result is `posix_spawnp failed` whenever the TTY tests try
// to spawn a pty. This restores the execute bit. Best-effort: never fails.
//
// Runs as the `pretest:tty` hook (and is safe to run anytime / on any platform).

import { createRequire } from "node:module";
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

// Windows uses conpty, not spawn-helper — nothing to do.
if (process.platform === "win32") {
  process.exit(0);
}

try {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("node-pty/package.json");
  const prebuilds = join(dirname(packageJson), "prebuilds");

  if (!existsSync(prebuilds)) {
    process.exit(0);
  }

  let fixed = 0;
  for (const entry of readdirSync(prebuilds)) {
    const helper = join(prebuilds, entry, "spawn-helper");
    if (!existsSync(helper)) continue;
    const { mode } = statSync(helper);
    // already has any execute bit?
    if (mode & 0o111) continue;
    chmodSync(helper, 0o755);
    fixed++;
    console.log(`[ensure-node-pty-executable] chmod +x ${helper}`);
  }
  if (fixed === 0) {
    console.log("[ensure-node-pty-executable] spawn-helper already executable");
  }
} catch (error) {
  // Best effort — don't break installs/tests if node-pty isn't present or the
  // layout changes in a future version.
  console.warn(
    `[ensure-node-pty-executable] skipped: ${error instanceof Error ? error.message : String(error)}`,
  );
}
