import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("env command (integration)", () => {
  const timeout = 15000;
  let binPath: string;

  beforeAll(() => {
    binPath = path.join(__dirname, "../../bin/development.js");
  });

  it(
    "prints the minimal reference with every var name plus Prerequisites and Examples sections",
    async () => {
      const { stdout } = await execAsync(`NO_COLOR=1 node ${binPath} env`, {
        env: { ...process.env, NO_COLOR: "1" },
      });
      const expected = [
        "ABLY_API_KEY",
        "ABLY_TOKEN",
        "ABLY_ACCESS_TOKEN",
        "ABLY_ENDPOINT",
        "ABLY_APP_ID",
        "ABLY_CLI_CONFIG_DIR",
        "ABLY_HISTORY_FILE",
        "ABLY_CLI_DEFAULT_DURATION",
        "ABLY_CLI_NON_INTERACTIVE",
      ];
      for (const name of expected) expect(stdout).toContain(name);
      expect(stdout).toContain("Prerequisites");
      expect(stdout).toContain("Examples");
    },
    timeout,
  );

  it(
    "per-var view contains var-specific content",
    async () => {
      const { stdout } = await execAsync(
        `NO_COLOR=1 node ${binPath} env ABLY_TOKEN`,
        { env: { ...process.env, NO_COLOR: "1" } },
      );
      expect(stdout).toContain("ABLY_TOKEN");
      expect(stdout).toContain("highest priority");
      expect(stdout).not.toContain("custom-endpoint.example.com");
    },
    timeout,
  );

  it(
    "--json emits the envVars envelope",
    async () => {
      const { stdout } = await execAsync(`node ${binPath} env --json`);
      const line = stdout.trim().split("\n").find(Boolean);
      const result = JSON.parse(line!);
      expect(result.type).toBe("result");
      expect(result.command).toBe("env");
      expect(result.success).toBe(true);
      expect(result.envVars).toHaveLength(9);
    },
    timeout,
  );

  it(
    "exits non-zero with a suggestion for an unknown var",
    async () => {
      const result = await execAsync(`node ${binPath} env ABLY_API_KEYY`)
        .then((r) => ({ ok: true as const, ...r }))
        .catch((error: { code?: number; stderr?: string }) => ({
          ok: false as const,
          code: error.code,
          stderr: error.stderr,
        }));
      expect(result.ok).toBe(false);
      expect((result as { code?: number }).code).not.toBe(0);
      expect((result as { stderr?: string }).stderr).toContain(
        "Did you mean ABLY_API_KEY",
      );
    },
    timeout,
  );
});
