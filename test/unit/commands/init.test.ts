import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../helpers/standard-tests.js";

describe("init command", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "init-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  standardHelpTests("init", import.meta.url);
  standardArgValidationTests("init", import.meta.url);
  standardFlagTests("init", import.meta.url, [
    "--skip-auth",
    "--global",
    "--target",
    "--force",
    "--skill",
    "--skills-repo",
    "--json",
  ]);

  describe("error handling", () => {
    it("should fail when --json is set without --skip-auth", async () => {
      const { stdout } = await runCommand(["init", "--json"], import.meta.url);
      // In JSON mode fail() emits a JSON error record on stdout and exits.
      expect(stdout).toMatch(/Authentication cannot run in --json mode/i);
      const firstLine = stdout.trim().split("\n")[0]!;
      const record = JSON.parse(firstLine) as {
        type: string;
        error: { message: string };
      };
      expect(record.type).toBe("error");
      expect(record.error.message).toMatch(
        /Authentication cannot run in --json mode/i,
      );
    });

    it("should delegate to skills:install and surface download failures", async () => {
      const { error } = await runCommand(
        [
          "init",
          "--skip-auth",
          "--target",
          "all",
          "--skills-repo",
          "ably/nonexistent-repo-xyz-12345",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Failed to download skills|Not Found/i);
    });
  });
});
