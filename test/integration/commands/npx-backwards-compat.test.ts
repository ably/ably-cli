import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(__dirname, "..", "..", "..", "bin", "run.js");

function run(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", [binPath, ...args], { env: { ...process.env } });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * `npx @ably/cli ably <command>` was historically the way to run the CLI (the
 * package is `@ably/cli`, the bin is `ably`, so the token gets repeated). Now
 * that the package is single-bin and `npx @ably/cli <command>` resolves
 * directly, run.js drops a redundant leading `ably` so the old form keeps
 * working. These tests guard that backwards-compatible behaviour.
 *
 * `version` is used because it runs fully offline (no API key required).
 */
describe("npx @ably/cli ably <command> backwards compatibility", () => {
  it("runs a command with a redundant leading `ably` token", async () => {
    const redundant = await run(["ably", "version"]);
    expect(redundant.code).toBe(0);
    expect(redundant.stdout).toContain("@ably/cli/");
    expect(redundant.stderr).not.toMatch(/not found/i);
  });

  it("behaves identically to the plain invocation", async () => {
    const [plain, redundant] = await Promise.all([
      run(["version"]),
      run(["ably", "version"]),
    ]);
    expect(redundant.stdout.trim()).toBe(plain.stdout.trim());
  });

  it("strips only a single leading `ably` (there is no `ably` command)", async () => {
    const doubled = await run(["ably", "ably", "version"]);
    expect(doubled.code).not.toBe(0);
    expect(doubled.stderr).toMatch(/not found/i);
  });
});
