import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "../../../package.json"), "utf8"),
) as { name: string; bin: Record<string, string> };

/**
 * Faithful re-implementation of npm's bin resolver, used by `npx`/`npm exec`
 * to decide which executable to run for a bare `npx <pkg>` invocation.
 *
 * Source of truth (kept in sync intentionally — this is a small, stable algo):
 * node_modules/libnpmexec/lib/get-bin-from-manifest.js
 *
 *   1. If every bin entry points at the SAME target, run the first one.
 *   2. Else if a bin is named after the unscoped package name, run that.
 *   3. Else throw "could not determine executable to run".
 *
 * This is why `npx @ably/cli <command>` must "just work" with no redundant
 * `ably` token: the package has to satisfy rule 1 or rule 2. A second bin that
 * points at a DIFFERENT target (e.g. a separate `ably-interactive` wrapper)
 * trips rule 3 and forces users into `npx -p @ably/cli ably <command>`.
 */
function getBinFromManifest(mani: {
  name: string;
  bin?: Record<string, string>;
}): string {
  const bin = mani.bin ?? {};
  if (new Set(Object.values(bin)).size === 1) {
    return Object.keys(bin)[0];
  }
  const unscoped = mani.name.replace(/^@[^/]+\//, "");
  if (bin[unscoped]) {
    return unscoped;
  }
  throw new Error("could not determine executable to run");
}

describe("npx @ably/cli bin resolution", () => {
  it("resolves to a single, deterministic executable (no redundant token)", () => {
    // If this throws, `npx @ably/cli <command>` breaks with
    // "could not determine executable to run" and users are forced back to
    // `npx -p @ably/cli ably <command>`.
    expect(() => getBinFromManifest(pkg)).not.toThrow();
    expect(getBinFromManifest(pkg)).toBe("ably");
  });

  it("the resolved bin is the main oclif entrypoint", () => {
    const binName = getBinFromManifest(pkg);
    expect(pkg.bin[binName]).toBe("./bin/run.js");
  });

  // Documents the failure mode the single-bin shape protects against, so a
  // future change that re-introduces a second, differently-targeted bin fails
  // loudly here rather than silently regressing the npx experience.
  it("regression guard: a second bin with a different target breaks npx", () => {
    expect(() =>
      getBinFromManifest({
        name: "@ably/cli",
        bin: {
          ably: "./bin/run.js",
          "ably-interactive": "./bin/ably-interactive",
        },
      }),
    ).toThrow(/could not determine executable to run/);
  });
});
