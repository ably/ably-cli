import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

function seedSkill(base: string, targetDir: string, skillName: string): void {
  const dir = path.join(base, targetDir, skillName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `# ${skillName}`);
}

describe("skills:uninstall command", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uninstall-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  standardHelpTests("skills:uninstall", import.meta.url);
  standardArgValidationTests("skills:uninstall", import.meta.url);
  standardFlagTests("skills:uninstall", import.meta.url, [
    "--global",
    "--target",
    "--force",
    "--json",
  ]);

  describe("functionality", () => {
    it("should remove skills for a specific target when --force is set", async () => {
      seedSkill(tempDir, ".claude/skills", "ably-pubsub");
      seedSkill(tempDir, ".cursor/skills", "ably-chat");

      const { error } = await runCommand(
        ["skills:uninstall", "--target", "claude-code", "--force"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(fs.existsSync(path.join(tempDir, ".claude", "skills"))).toBe(
        false,
      );
      // other targets untouched
      expect(
        fs.existsSync(path.join(tempDir, ".cursor", "skills", "ably-chat")),
      ).toBe(true);
    });

    it("should be a no-op when nothing is installed", async () => {
      const { stderr, error } = await runCommand(
        ["skills:uninstall", "--force"],
        import.meta.url,
      );
      expect(error).toBeUndefined();
      expect(stderr).toMatch(/No installed skills found/i);
    });

    it("should emit structured JSON with --force --json", async () => {
      seedSkill(tempDir, ".claude/skills", "ably-pubsub");

      const { stdout, error } = await runCommand(
        ["skills:uninstall", "--target", "claude-code", "--force", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      const firstLine = stdout.trim().split("\n")[0]!;
      const record = JSON.parse(firstLine) as {
        type: string;
        removed: Array<{ target: string; removed: boolean }>;
      };
      expect(record.type).toBe("result");
      expect(record.removed).toHaveLength(1);
      expect(record.removed[0]!.target).toBe("claude-code");
      expect(record.removed[0]!.removed).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should require --force when --json is set", async () => {
      // Seed a skill so we get past the "nothing to remove" early return
      fs.mkdirSync(path.join(tempDir, ".claude", "skills", "ably-pubsub"), {
        recursive: true,
      });

      const { stdout } = await runCommand(
        ["skills:uninstall", "--target", "claude-code", "--json"],
        import.meta.url,
      );

      // In JSON mode fail() emits a JSON error record on stdout and exits.
      const lines = stdout.trim().split("\n");
      const errorLine = lines.find((line) => {
        try {
          return (JSON.parse(line) as { type?: string }).type === "error";
        } catch {
          return false;
        }
      });
      expect(errorLine).toBeDefined();
      const record = JSON.parse(errorLine!) as {
        type: string;
        error: { message: string };
      };
      expect(record.type).toBe("error");
      expect(record.error.message).toMatch(/--force flag is required/i);
    });
  });
});
