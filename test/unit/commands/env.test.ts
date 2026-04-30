import { runCommand } from "@oclif/test";
import { describe, expect, it } from "vitest";

import {
  standardArgValidationTests,
  standardHelpTests,
} from "../../helpers/standard-tests.js";
import { parseJsonOutput } from "../../helpers/ndjson.js";

const CANONICAL_NAMES = [
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

describe("env command", () => {
  standardHelpTests("env", import.meta.url);
  standardArgValidationTests("env", import.meta.url);

  describe("--list", () => {
    it("prints exactly 9 names, one per line", async () => {
      const { stdout } = await runCommand(["env", "--list"], import.meta.url);
      expect(stdout.trim().split("\n")).toEqual(CANONICAL_NAMES);
    });

    it("emits envVarNames envelope when combined with --json", async () => {
      const { stdout } = await runCommand(
        ["env", "--list", "--json"],
        import.meta.url,
      );
      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "env");
      expect(result).toHaveProperty("success", true);
      expect(result.envVarNames).toEqual(CANONICAL_NAMES);
    });
  });

  describe("--json", () => {
    it("emits envVars + crossCutting + relatedLinks envelope (no args)", async () => {
      const { stdout } = await runCommand(["env", "--json"], import.meta.url);
      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "env");
      expect(result).toHaveProperty("success", true);
      expect(result.envVars).toHaveLength(9);
      expect(result.envVars[0]).toMatchObject({
        name: "ABLY_API_KEY",
        category: "Authentication",
        format: "APP_ID.KEY_ID:KEY_SECRET",
      });
      expect(result.envVars[3].name).toBe("ABLY_ENDPOINT");
      expect(result.envVars[8].name).toBe("ABLY_CLI_NON_INTERACTIVE");
      expect(result.crossCutting).toBeDefined();
      expect(result.crossCutting.authResolutionOrder.heading).toBe(
        "Authentication Resolution Order",
      );
      expect(result.relatedLinks).toHaveLength(8);
    });

    it("emits envVar singular envelope with rich details for a single var", async () => {
      const { stdout } = await runCommand(
        ["env", "ABLY_API_KEY", "--json"],
        import.meta.url,
      );
      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result.envVar.name).toBe("ABLY_API_KEY");
      expect(result.envVar.category).toBe("Authentication");
      expect(result.envVar.format).toBe("APP_ID.KEY_ID:KEY_SECRET");
      expect(result.envVar.intro).toBeDefined();
      expect(result.envVar.example).toBeDefined();
      expect(result.envVar.details.length).toBeGreaterThan(0);
    });

    it("matches case-insensitively", async () => {
      const { stdout } = await runCommand(
        ["env", "ably_api_key", "--json"],
        import.meta.url,
      );
      const result = parseJsonOutput(stdout);
      expect(result.envVar.name).toBe("ABLY_API_KEY");
    });
  });

  describe("error handling", () => {
    it("suggests a closest match for a typo", async () => {
      const { error } = await runCommand(
        ["env", "ABLY_API_KEYY"],
        import.meta.url,
      );
      expect(error?.message).toContain("Unknown environment variable");
      expect(error?.message).toContain("Did you mean ABLY_API_KEY");
    });

    it("does not suggest an unsupported var like DEBUG", async () => {
      const { error } = await runCommand(["env", "DEBUG"], import.meta.url);
      expect(error?.message).toContain("Unknown environment variable");
      expect(error?.message).not.toContain("Did you mean");
    });

    it("rejects --list combined with a positional var name", async () => {
      const { error } = await runCommand(
        ["env", "ABLY_API_KEY", "--list"],
        import.meta.url,
      );
      expect(error?.message).toContain("Pass either --list or a variable name");
    });
  });

  describe("rendered output", () => {
    it("contains every var name in the minimal default view", async () => {
      const { stdout } = await runCommand(["env"], import.meta.url);
      for (const name of CANONICAL_NAMES) expect(stdout).toContain(name);
    });

    it("contains the Prerequisites and Examples headings", async () => {
      const { stdout } = await runCommand(["env"], import.meta.url);
      expect(stdout).toContain("Prerequisites");
      expect(stdout).toContain("Data plane commands");
      expect(stdout).toContain("Control API commands");
      expect(stdout).toContain("Examples");
      expect(stdout).not.toContain("Quick Reference");
    });

    it("does not render cross-cutting sections in the minimal view", async () => {
      const { stdout } = await runCommand(["env"], import.meta.url);
      expect(stdout).not.toContain("Authentication Resolution Order");
      expect(stdout).not.toContain("Running Commands Without Login");
      expect(stdout).not.toContain("CI/CD Usage");
      expect(stdout).not.toContain("Commands by Auth Type");
    });

    it("does not contain any dev-only references", async () => {
      const { stdout } = await runCommand(["env"], import.meta.url);
      expect(stdout).not.toContain("Development-Usage.md");
      expect(stdout).not.toContain("Debugging.md");
      expect(stdout).not.toContain("Testing.md");
      expect(stdout).not.toContain("Troubleshooting.md");
      expect(stdout).not.toContain("Interactive-REPL.md");
      expect(stdout).not.toContain("Testing note:");
    });

    it("contains the TIP footer", async () => {
      const { stdout } = await runCommand(["env"], import.meta.url);
      expect(stdout).toContain(
        "TIP: Run `ably env <NAME>` for a focused single-variable view.",
      );
    });

    it("renders only the requested var when name is passed", async () => {
      const { stdout } = await runCommand(
        ["env", "ABLY_TOKEN"],
        import.meta.url,
      );
      expect(stdout).toContain("ABLY_TOKEN");
      expect(stdout).toContain("highest priority");
      expect(stdout).not.toContain("custom-endpoint.example.com");
      expect(stdout).not.toContain("TIP: Run");
    });
  });
});
